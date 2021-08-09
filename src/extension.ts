import got, { Response } from "got/dist/source";
import * as vscode from "vscode";

interface OpenApi {
    openApi: string;
    info: { title: string; version: string };
    paths: any;
    components: any;
}

class SwaggerTreeProvider
    implements
        vscode.TreeDataProvider<Endpoint | HttpMethodTreeItem | RequestBodyParameter>
{
    constructor(public swaggerJsonUrl: string) {}

    getTreeItem(element: Endpoint): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(
        element?: Endpoint | HttpMethodTreeItem
    ): Promise<Endpoint[] | HttpMethodTreeItem[] | RequestBodyParameter[]> {}

    private _onDidChangeTreeData: vscode.EventEmitter<
        Endpoint | undefined | null | void
    > = new vscode.EventEmitter<Endpoint | undefined | null | void>();

    readonly onDidChangeTreeData?:
        | vscode.Event<void | Endpoint | null | undefined>
        | undefined = this._onDidChangeTreeData.event;

    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

class RequestBodyParameter extends vscode.TreeItem {
    constructor(
        public readonly parameter: {
            name: string;
            type: string;
        }
    ) {
        super(parameter.name, vscode.TreeItemCollapsibleState.None);
        this.description = parameter.type;
        this.iconPath = new vscode.ThemeIcon("symbol-interface");
    }
}

export function activate(context: vscode.ExtensionContext) {
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
