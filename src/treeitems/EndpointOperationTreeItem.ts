import * as vscode from "vscode";
import { OperationObject } from "openapi3-ts";

export class EndpointOperationTreeItem extends vscode.TreeItem {
    constructor(
        public readonly operation: OperationObject,
        public readonly name: string,
        public readonly parentPath: string,
        public readonly icon?: vscode.ThemeIcon
    ) {
        super(`${name.toUpperCase()}`);
        this.description = parentPath;
        this.iconPath = icon ?? new vscode.ThemeIcon("circle-outline");
        this.contextValue = "endpoint-operation";

        this.collapsibleState =
            this.operation.requestBody === undefined
                ? vscode.TreeItemCollapsibleState.None
                : vscode.TreeItemCollapsibleState.Collapsed;
    }
}
