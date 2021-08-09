import * as vscode from "vscode";
import {
    OpenAPIObject,
    OperationObject,
    ReferenceObject,
    RequestBodyObject,
    SchemaObject,
} from "openapi3-ts";
import { OperationBodyParameter } from "./OperationBodyParameter";
import { BodyWithContent } from "../types";
import { bodyParamContentType } from "../extension";

export class EndpointOperationTreeItem extends vscode.TreeItem {
    constructor(
        public readonly operation: OperationObject,
        public readonly name: string,
        public readonly parentPath: string,
        public readonly openApi: OpenAPIObject,
        public readonly icon?: vscode.ThemeIcon,
        public readonly params?: OperationBodyParameter[]
    ) {
        super(`${name.toUpperCase()}`);
        this.description = parentPath;
        this.iconPath = icon ?? new vscode.ThemeIcon("circle-outline");
        this.contextValue = "endpoint-operation";

        this.collapsibleState =
            this.operation.requestBody === undefined
                ? vscode.TreeItemCollapsibleState.None
                : vscode.TreeItemCollapsibleState.Collapsed;

        if (this.operation.requestBody) {
            this.params = getParamsFromBody(
                this.operation.requestBody as BodyWithContent,
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
        }
    }
}

export type Params = [
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
