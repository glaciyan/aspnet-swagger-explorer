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
import { URL } from "url";

export let bodyParamContentType = "application/json";

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
            if (this.swaggerJsonUrl.trim().length === 0) return Promise.resolve([]);
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
                            this.openApi!,
                            op.icon
                        )
                )
            );
        } else if (element.contextValue === "endpoint-operation") {
            // Operation Parameters

            element = element as EndpointOperationTreeItem;

            return Promise.resolve(
                [new OperationBodyContentTypeLabel(bodyParamContentType)].concat(
                    //@ts-ignore
                    element.params
                )
            );
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

export async function activate(context: vscode.ExtensionContext) {
    const defaultSwaggerJsonUrl = "http://localhost:5000/swagger/v1/swagger.json";
    const swaggerTree = new SwaggerTreeProvider(
        (await context.workspaceState.get("aspswagview.setJsonUrl")) ?? ""
    );

    const tree = vscode.window.registerTreeDataProvider("swagger", swaggerTree);

    const setSwaggerJsonUrlCommand = async () => {
        const newUrl = await vscode.window.showInputBox({
            title: "Enter a swagger.json url",
            value: defaultSwaggerJsonUrl,
        });

        if (newUrl) {
            swaggerTree.swaggerJsonUrl = newUrl ?? defaultSwaggerJsonUrl;
            swaggerTree.refresh();
            await context.workspaceState.update("aspswagview.setJsonUrl", newUrl);
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

    const runCommand = vscode.commands.registerCommand(
        "aspswagview.createRequest",
        async (node: EndpointOperationTreeItem) => {
            vscode.window.showInformationMessage(`${node.name}`);
            const url = new URL(swaggerTree.swaggerJsonUrl);

            const doc = await vscode.workspace.openTextDocument({
                language: "http",
                content: `###
${node.name.toUpperCase()} ${url.protocol}//${url.host}${node.parentPath} HTTP/1.1${
                    node.params
                        ? `
Content-Type: application/json

{

}`
                        : ""
                }`,
            });

            vscode.window.showTextDocument(doc);
        }
    );

    context.subscriptions.push(tree);
    context.subscriptions.push(changeCommand);
    context.subscriptions.push(refreshCommand);
}
