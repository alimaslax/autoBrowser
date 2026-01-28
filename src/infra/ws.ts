import { RawData } from "ws";

export function rawDataToString(data: RawData): string {
    if (Buffer.isBuffer(data)) {
        return data.toString();
    }
    if (Array.isArray(data)) {
        return Buffer.concat(data).toString();
    }
    if (data instanceof ArrayBuffer) {
        return Buffer.from(data).toString();
    }
    return String(data);
}
