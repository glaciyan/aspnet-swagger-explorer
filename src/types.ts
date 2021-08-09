import { RequestBodyObject, ReferenceObject } from "openapi3-ts";

export type BodyWithContent = {
    content: { [contentType: string]: { schema: RequestBodyObject | ReferenceObject } };
};

export type paramTypes =
    | "integer"
    | "number"
    | "string"
    | "boolean"
    | "object"
    | "null"
    | "array";
export type paramFormat =
    | "int32"
    | "int64"
    | "float"
    | "double"
    | "byte"
    | "binary"
    | "date"
    | "date-time"
    | "password"
    | string;
