import * as vscode from "vscode";

export class OperationBodyParameter extends vscode.TreeItem {
    constructor(
        public readonly parameterName: string,
        public readonly type?: string,
        public readonly format?: string,
        public readonly nullable?: boolean,
        public readonly isRef?: boolean
    ) {
        super(`${parameterName}${nullable ? "?" : ""}`);
        this.description = isRef ? "object" : parseTypeAndFormat(type, format);
        this.contextValue = "operation-body-param";
        this.iconPath = resolveOperationIcon(this.description);
    }
}

export class OperationBodyContentTypeLabel extends vscode.TreeItem {
    constructor(public readonly contentType: string) {
        super(contentType);
        this.contextValue = "operation-body-contenttype";
    }
}

export function resolveOperationIcon(description: string): vscode.ThemeIcon {
    if (
        description.startsWith("integer") ||
        description == "double" ||
        description == "float"
    )
        return new vscode.ThemeIcon("symbol-number");

    if (description.startsWith("string")) return new vscode.ThemeIcon("symbol-text");

    if (description.startsWith("date")) return new vscode.ThemeIcon("calendar");

    if (description === "array") return new vscode.ThemeIcon("array");

    if (description === "object") return new vscode.ThemeIcon("json");

    return new vscode.ThemeIcon("note");
}

export function parseTypeAndFormat(type?: string, format?: string): string {
    if (type === "number") {
        switch (format) {
            case "float":
                return format;
            case "double":
                return format;
            default:
                return type;
        }
    } else if (type === "integer") {
        switch (format) {
            case "int32":
                return "integer(int32)";
            case "int64":
                return "integer(int64)";
            default:
                return "integer";
        }
    } else if (type === "string") {
        if (!format) return type;
        switch (format) {
            case "date":
                return format;
            case "date-time":
                return format;
            case "password":
                return format;

            default:
                return `${type}(${format})`;
        }
    } else {
        return type ?? "";
    }
}
