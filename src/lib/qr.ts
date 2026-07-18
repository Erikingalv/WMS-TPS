import QRCode from "qrcode";

export async function generarQrDataUrl(texto: string): Promise<string> {
  return QRCode.toDataURL(texto, {
    margin: 1,
    width: 320,
    // Fondo blanco sólido siempre, sin importar el tema de la app: un QR
    // necesita contraste fijo para escanear (y eventualmente imprimirse en
    // una etiqueta), no debe depender de si la tarjeta detrás es clara u oscura.
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}
