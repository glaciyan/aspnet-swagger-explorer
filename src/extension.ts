import SwaggerParser = require("@apidevtools/swagger-parser");
import got, { Response } from "got/dist/source";
import * as vscode from "vscode";
import { OpenAPIObject, PathItemObject } from "openapi3-ts";
import { EndpointTreeItem } from "./EndpointTreeItem";
import { EndpointOperationTreeItem } from "./EndpointOperationTreeItem";

type TreeItemTypes = EndpointTreeItem | EndpointOperationTreeItem;

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
            return Promise.resolve(
                Object.entries(this.openApi.paths).map(
                    ([name, path]: [string, PathItemObject]) => {
                        return new EndpointTreeItem(path, name);
                    }
                )
            );
        } else if (element.contextValue === "endpoint") {
            element = element as EndpointTreeItem;

            return Promise.resolve(
                element.operations.map(
                    (op) =>
                        new EndpointOperationTreeItem(
                            op.obj,
                            op.type,
                            element!.name,
                            op.icon
                        )
                )
            );
        } else {
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
    const swaggerTree = new SwaggerTreeProvider(defaultSwaggerJsonUrl);

    const tree = vscode.window.registerTreeDataProvider("swagger", swaggerTree);

    const setSwaggerJsonUrlCommand = async () => {
        const newUrl = await vscode.window.showInputBox({
            title: "Set url",
            placeHolder: "Enter a swagger.json url",
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
