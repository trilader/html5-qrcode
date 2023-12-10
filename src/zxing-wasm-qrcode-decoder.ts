/**
 * @fileoverview
 * {@interface QrcodeDecoder} wrapper around ZXing-Wasm library.
 *
 * @author trilader <trilader@schroedingers-bit.net>
 *
 * ZXing library is available at https://github.com/Sec-ant/zxing-wasm.
 *
 * The word "QR Code" is registered trademark of DENSO WAVE INCORPORATED
 * http://www.denso-wave.com/qrcode/faqpatent-e.html
 */

import {
    ReadResult,
    readBarcodesFromImageData,
    setZXingModuleOverrides,
    type DecodeHints,
} from "zxing-wasm";

import {
    Html5QrcodeSupportedFormats,
    Logger,
    QrcodeDecoderAsync,
    QrcodeResult,
    QrcodeResultDebugData,
    QrcodeResultFormat
} from "./core";

/**
 * ZXing based Code decoder.
 */
export class ZXingWasmQrcodeDecoder implements QrcodeDecoderAsync {
    private readonly formatMap: Map<Html5QrcodeSupportedFormats, string>
        = new Map([
            [Html5QrcodeSupportedFormats.QR_CODE, "QRCode" ],
            [Html5QrcodeSupportedFormats.AZTEC, "Aztec" ],
            [Html5QrcodeSupportedFormats.CODABAR, "Codabar" ],
            [Html5QrcodeSupportedFormats.CODE_39, "Code39" ],
            [Html5QrcodeSupportedFormats.CODE_93, "Code93" ],
            [Html5QrcodeSupportedFormats.CODE_128, "Code128" ],
            [Html5QrcodeSupportedFormats.DATA_MATRIX, "DataMatrix" ],
            [Html5QrcodeSupportedFormats.MAXICODE, "MaxiCode" ],
            [Html5QrcodeSupportedFormats.ITF, "ITF" ],
            [Html5QrcodeSupportedFormats.EAN_13, "EAN-13" ],
            [Html5QrcodeSupportedFormats.EAN_8, "EAN-8" ],
            [Html5QrcodeSupportedFormats.PDF_417, "PDF417" ],
            [Html5QrcodeSupportedFormats.UPC_A, "UPC-A" ],
            [Html5QrcodeSupportedFormats.UPC_E, "UPC-E" ],
        ]);
    private readonly reverseFormatMap: Map<string, Html5QrcodeSupportedFormats>
        = this.createReverseFormatMap();

    private verbose: boolean;
    private logger: Logger;

    private decodeHints: DecodeHints;
    private wasmLocationOverride?: string;

    public constructor(
        requestedFormats: Array<Html5QrcodeSupportedFormats>,
        verbose: boolean,
        logger: Logger,
        wasmLocationOveride: string | undefined = undefined) {
        if (typeof wasmLocationOveride !== "undefined") {
            this.wasmLocationOverride = wasmLocationOveride;
            if (!this.wasmLocationOverride.endsWith("/"))
                this.wasmLocationOverride += "/";

            setZXingModuleOverrides({
                locateFile: (path, prefix) => {
                    if (path.endsWith(".wasm")) {
                        return `${this.wasmLocationOverride}${path}`;
                    }
                    return prefix + path;
                },
            });
        }

        const formats = this.createZXingFormats(requestedFormats);

        this.decodeHints = {
            tryHarder: false,
            formats: formats,
            maxNumberOfSymbols: 1,
        }

        this.verbose = verbose;
        this.logger = logger;
    }

    decodeAsync(canvas: HTMLCanvasElement): Promise<QrcodeResult> {
        return new Promise((resolve, reject) => {
            try {
                resolve(this.decode(canvas));
            } catch (error) {
                reject(error);
            }
        });
    }

    private async decode(canvas: HTMLCanvasElement): Promise<QrcodeResult> {
        const ctx: CanvasRenderingContext2D = canvas.getContext("2d",  { willReadFrequently: true })!;
        let result = await readBarcodesFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), this.decodeHints);
        if (result.length === 0)
            throw ("No code found");

        const res: ReadResult = result[0];

        return {
            text: res.text,
            format: QrcodeResultFormat.create(
                this.toHtml5QrcodeSupportedFormats(res.format)),
                debugData: this.createDebugData()
        };
    }

    private createReverseFormatMap(): Map<any, Html5QrcodeSupportedFormats> {
        let result = new Map();
        this.formatMap.forEach(
            (value: any, key: Html5QrcodeSupportedFormats, _) => {
            result.set(value, key);
        });
        return result;
    }

    private toHtml5QrcodeSupportedFormats(zxingFormat: any)
        : Html5QrcodeSupportedFormats {
        if (!this.reverseFormatMap.has(zxingFormat)) {
            throw `reverseFormatMap doesn't have ${zxingFormat}`;
        }
        return this.reverseFormatMap.get(zxingFormat)!;
    }

    private createZXingFormats(
        requestedFormats: Array<Html5QrcodeSupportedFormats>):
        Array<any> {
            let zxingFormats = [];
            for (const requestedFormat of requestedFormats) {
                if (this.formatMap.has(requestedFormat)) {
                    zxingFormats.push(
                        this.formatMap.get(requestedFormat));
                } else {
                    this.logger.logError(`${requestedFormat} is not supported by`
                        + "ZXingWasmQrcodeShim");
                }
            }
            return zxingFormats;
    }

    private createDebugData(): QrcodeResultDebugData {
        return { decoderName: "zxing-wasm" };
    }
}
