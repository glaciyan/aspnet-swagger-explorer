import * as vscode from "vscode";
import { OperationObject, PathItemObject } from "openapi3-ts";

export class EndpointTreeItem extends vscode.TreeItem {
    operations: Operation[];
    constructor(public readonly path: PathItemObject, public readonly name: string) {
        super(name, vscode.TreeItemCollapsibleState.Collapsed);
        this.operations = getOperations(path);
        this.description = this.operations.map((op) => op.type).join(", ");
        this.iconPath = new vscode.ThemeIcon("symbol-interface");
        this.contextValue = "endpoint";
    }
}

export interface Operation {
    type: "get" | "put" | "post" | "delete" | "options" | "head" | "patch" | "trace";
    icon?: vscode.ThemeIcon;
    obj: OperationObject;
}

export function getOperations(path: PathItemObject): Operation[] {
    const operations: Operation[] = [];

    if (path.get) operations.push({ type: "get", obj: path.get });
    if (path.put) operations.push({ type: "put", obj: path.put });
    if (path.post) operations.push({ type: "post", obj: path.post });
    if (path.delete) operations.push({ type: "delete", obj: path.delete });
    if (path.options) operations.push({ type: "options", obj: path.options });
    if (path.head) operations.push({ type: "head", obj: path.head });
    if (path.patch) operations.push({ type: "patch", obj: path.patch });
    if (path.trace) operations.push({ type: "trace", obj: path.trace });

    return operations;
}
