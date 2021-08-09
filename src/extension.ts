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

    openApi: OpenApi | undefined;

    openApiResponse: Response<string> | undefined;

    getTreeItem(element: Endpoint): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    async getChildren(
        element?: Endpoint | HttpMethodTreeItem
    ): Promise<Endpoint[] | HttpMethodTreeItem[] | RequestBodyParameter[]> {
        if (element) {
            if (element.contextValue === "httpmethod") {
                element = element as HttpMethodTreeItem;
                return Promise.resolve(
                    element.method.requestBody.map((reqbody) => {
                        return new RequestBodyParameter(reqbody);
                    })
                );
            } else {
                element = element as Endpoint;
                return Promise.resolve(
                    element.methods.map((method) => {
                        return new HttpMethodTreeItem(method);
                    })
                );
            }
        } else {
            if (!this.openApi) {
                this.openApiResponse = await got(this.swaggerJsonUrl);
                this.openApi = JSON.parse(this.openApiResponse.body);
            }

            const paths = Object.entries(this.openApi!.paths);

            return Promise.resolve(
                paths.map(
                    ([key, value]: [string, any]) =>
                        new Endpoint(
                            key,
                            Object.entries(value).map(([key, value]) => {
                                const path = (value as any).requestBody?.content[
                                    "application/json"
                                ].schema["$ref"] as string;

                                return {
                                    type: key,
                                    requestBody: path
                                        ? getBodyParams(path, this.openApi!)
                                        : [],
                                };
                            })
                        )
                )
            );
        }
    }

    private _onDidChangeTreeData: vscode.EventEmitter<
        Endpoint | undefined | null | void
    > = new vscode.EventEmitter<Endpoint | undefined | null | void>();

    readonly onDidChangeTreeData?:
        | vscode.Event<void | Endpoint | null | undefined>
        | undefined = this._onDidChangeTreeData.event;

    refresh() {
        this.openApi = undefined;
        this._onDidChangeTreeData.fire();
    }
}

function getBodyParams(path: string, api: OpenApi): BodyParam[] {
    const name = path.split("/").pop()!;

    return Object.entries(api.components.schemas[name].properties).map(
        ([field, type]: [string, any]) => {
            return {
                name: `${field}${type.nullable ? "?" : ""}`,
                type: `${type.type}${
                    type.format !== undefined ? `(${type.format})` : ""
                }`,
            };
        }
    );
}

interface BodyParam {
    name: string;
    type: string;
}

interface HttpMethod {
    type: string;
    requestBody: BodyParam[];
}

class Endpoint extends vscode.TreeItem {
    constructor(public readonly name: string, public readonly methods: HttpMethod[]) {
        super(name, vscode.TreeItemCollapsibleState.Collapsed);
        this.description = methods.map((method) => method.type).join(", ");
        this.iconPath = new vscode.ThemeIcon("symbol-interface");
    }
}

class HttpMethodTreeItem extends vscode.TreeItem {
    constructor(public readonly method: HttpMethod) {
        super(
            method.type,
            method.requestBody.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );
        this.description = "Endpoint";
        this.contextValue = "httpmethod";

        switch (method.type) {
            case "get":
                this.iconPath = new vscode.ThemeIcon("cloud-download");
                break;

            case "delete":
                this.iconPath = new vscode.ThemeIcon(
                    "trash",
                    new vscode.ThemeColor("testing.iconFailed")
                );
                break;

            case "post":
                this.iconPath = new vscode.ThemeIcon(
                    "cloud-upload",
                    new vscode.ThemeColor("testing.iconPassed")
                );
                break;

            case "put":
                this.iconPath = new vscode.ThemeIcon(
                    "debug-step-into",
                    new vscode.ThemeColor("foreground")
                );

                break;

            case "patch":
                this.iconPath = new vscode.ThemeIcon("wrench");
                break;

            default:
                this.iconPath = new vscode.ThemeIcon("debug-breakpoint-unverified");
                break;
        }
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
    const tree = vscode.window.registerTreeDataProvider<
        HttpMethodTreeItem | RequestBodyParameter | Endpoint
    >("swagger", swaggerTree);

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
