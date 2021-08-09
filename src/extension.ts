import got, { Response } from "got/dist/source";
import * as vscode from "vscode";
import {
    OpenAPIObject,
    PathItemObject,
    ReferenceObject,
    RequestBodyObject,
    SchemaObject,
} from "openapi3-ts";
import { EndpointTreeItem } from "./treeitems/EndpointTreeItem";
import { EndpointOperationTreeItem } from "./treeitems/EndpointOperationTreeItem";
import { BodyWithContent } from "./types";
import {
    OperationBodyContentTypeLabel,
    OperationBodyParameter,
} from "./treeitems/OperationBodyParameter";

let bodyParamContentType = "application/json";

type TreeItemTypes =
    | EndpointTreeItem
    | EndpointOperationTreeItem
    | OperationBodyParameter
    | OperationBodyContentTypeLabel;

class SwaggerTreeProvider implements vscode.TreeDataProvider<TreeItemTypes> {
    constructor(public swaggerJsonUrl: string) {}

    public openApi?: OpenAPIObject;

    getTreeItem(element: TreeItemTypes): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(element?: TreeItemTypes): Promise<TreeItemTypes[]> {
        if (!this.openApi) {
            const parsed = JSON.parse(
                (await got(this.swaggerJsonUrl)).body
            ) as OpenAPIObject;
            this.openApi = parsed;
        }

        if (!element) {
            // Endpoints

            return Promise.resolve(
                Object.entries(this.openApi.paths).map(
                    ([name, path]: [string, PathItemObject]) => {
                        return new EndpointTreeItem(path, name);
                    }
                )
            );
        } else if (element.contextValue === "endpoint") {
            // Operations
            element = element as EndpointTreeItem;

            return Promise.resolve(
                element.operations.map(
                    (op) =>
                        new EndpointOperationTreeItem(
                            op.obj,
                            op.type,
                            (element as EndpointTreeItem).name,
                            op.icon
                        )
                )
            );
        } else if (element.contextValue === "endpoint-operation") {
            // Operation Parameters

            element = element as EndpointOperationTreeItem;

            if (element.operation.requestBody) {
                const params: OperationBodyParameter[] = getParamsFromBody(
                    element.operation.requestBody as BodyWithContent,
                    this.openApi
                ).map(([name, schema]) => {
                    return new OperationBodyParameter(
                        name,
                        schema.type,
                        schema.format,
                        schema.nullable,
                        schema.isRef
                    );
                });

                return Promise.resolve(
                    [new OperationBodyContentTypeLabel(bodyParamContentType)].concat(
                        //@ts-ignore
                        params
                    )
                );
            } else {
                // Empty when no bodyparams
                return Promise.resolve([]);
            }
        } else {
            // Default nothing
            return Promise.resolve([]);
        }
    }

    //#region refresh
    private _onDidChangeTreeData: vscode.EventEmitter<
        TreeItemTypes | undefined | null | void
    > = new vscode.EventEmitter<TreeItemTypes | undefined | null | void>();

    readonly onDidChangeTreeData?:
        | vscode.Event<void | TreeItemTypes | null | undefined>
        | undefined = this._onDidChangeTreeData.event;

    refresh() {
        this.openApi = undefined;
        this._onDidChangeTreeData.fire();
    }
    //#endregion
}

type Params = [
    string,
    {
        type?: string;
        format?: string;
        isRef?: boolean;
        nullable: boolean;
    }
][];

function getParamsFromBody(
    bodyWithContent: BodyWithContent,
    openApi: OpenAPIObject
): Params {
    let body = bodyWithContent.content[bodyParamContentType].schema;

    if (body.$ref) {
        body = body as ReferenceObject;
        const schema = resolveRef(body.$ref, openApi);
        if (!schema)
            return [["Something went from resolving the reference", { nullable: false }]];

        const [_, schemaObj] = schema;

        const params = getProperties(schemaObj);

        return params ?? [];
    } else {
        body = body as RequestBodyObject;
        return [["Only references are supported", { nullable: false }]];
    }
}

function resolveRef(
    $ref: string,
    openApi: OpenAPIObject
): [string, SchemaObject] | undefined {
    if (!$ref.startsWith("#")) {
        return undefined;
    }

    const path = $ref.split("/");

    const schemas = openApi.components?.schemas;
    if (!schemas) return undefined;

    const schemaName = path[path.length - 1];

    return [schemaName, schemas[schemaName]];
}

function getProperties(schema: SchemaObject): Params | undefined {
    if (!schema.properties) return undefined;

    return Object.entries(schema.properties).map(
        ([name, schema]: [string, SchemaObject]) => {
            return [
                name,
                {
                    type: schema.type,
                    format: schema.format,
                    isRef: !!schema.$ref,
                    nullable: schema.nullable ?? false,
                },
            ];
        }
    );
}

export async function activate(context: vscode.ExtensionContext) {
    const defaultSwaggerJsonUrl = "http://localhost:5000/swagger/v1/swagger.json";
    const swaggerTree = new SwaggerTreeProvider(defaultSwaggerJsonUrl);

    const tree = vscode.window.registerTreeDataProvider("swagger", swaggerTree);

    const setSwaggerJsonUrlCommand = async () => {
        const newUrl = await vscode.window.showInputBox({
            title: "Enter a swagger.json url",
            value: defaultSwaggerJsonUrl,
        });

        if (newUrl) {
            swaggerTree.swaggerJsonUrl = newUrl ?? defaultSwaggerJsonUrl;
            swaggerTree.refresh();
        }
    };

    const changeCommand = vscode.commands.registerCommand(
        "aspswagview.setSwaggerJsonUrl",
        setSwaggerJsonUrlCommand
    );

    const refreshCommand = vscode.commands.registerCommand(
        "aspswagview.refreshEndpoints",
        () => {
            swaggerTree.refresh();
        }
    );

    context.subscriptions.push(tree);
    context.subscriptions.push(changeCommand);
    context.subscriptions.push(refreshCommand);
}
