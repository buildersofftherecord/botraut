import { describe, it, expect } from "vitest";
import type { Attachment } from "chat";
import { InvitadoSchema, PlacaSchema, type Copy } from "./tipos";
import { PEDIDO_DE_FOTO } from "./foto";
import {
  NO_ENCONTRADO,
  ID_BOTON_FECHA,
  TEXTO_BOTON_FECHA,
  CALLBACK_ID_MODAL_FECHA,
  TITULO_MODAL_FECHA,
  mensajeNombreLargo,
  mensajeNoEncontrado,
  mensajeCopy,
  mensajeErrorBusqueda,
  extraerFotoAdjunta,
  listoParaFecha,
  mensajeFotoSinCopy,
  NO_ENTENDI,
  mensajeGenerando,
  mensajePlacaLista,
  mensajeSinFotoParaPlaca,
  mensajeErrorPlaca,
  nombreArchivoPlaca,
  erroresModalFecha,
} from "./mensajes";
import { DATOS_DEMO } from "./demo";

describe("mensajeNombreLargo", () => {
  it("incluye el largo real y el máximo real del schema", () => {
    const nombre = "a".repeat(30);
    // Se arma el error contra el schema real, no un ZodError inventado a
    // mano — así la prueba también pega si InvitadoSchema deja de valer 24.
    const resultado = InvitadoSchema.shape.nombre.safeParse(nombre);
    if (resultado.success) throw new Error("fixture inválido: se esperaba que el nombre fallara");

    const mensaje = mensajeNombreLargo(nombre, resultado.error);

    expect(mensaje).toContain("30");
    expect(mensaje).toContain("24");
  });
});

describe("mensajeNoEncontrado", () => {
  it("menciona el nombre", () => {
    expect(mensajeNoEncontrado("Naomi Couriel")).toContain("Naomi Couriel");
  });

  // La regresión que motivó este archivo: el literal del protocolo con el
  // prompt no tiene que llegar nunca al canal.
  it("no contiene el literal NO_ENCONTRADO", () => {
    expect(mensajeNoEncontrado("Naomi Couriel")).not.toContain(NO_ENCONTRADO);
  });
});

describe("mensajeCopy", () => {
  const copyReal: Copy = {
    rol: "AI Engineering en UdeSA y Data & AI en Ualá",
    genero: "f",
    fuentes: [],
  };

  it("publica el rol y pide la foto cuando hay copy", () => {
    const mensaje = mensajeCopy("Naomi Couriel", copyReal);
    expect(mensaje).toContain(copyReal.rol);
    expect(mensaje).toContain("INVITADA");
    expect(mensaje).toContain(PEDIDO_DE_FOTO);
  });

  // La regresión: el literal del protocolo con el prompt llegaba al canal como
  // si fuera un rol real ("NAOMI COURIEL — NO_ENCONTRADO").
  it("con NO_ENCONTRADO pide el dato en vez de publicar el literal", () => {
    const mensaje = mensajeCopy("Naomi Couriel", { ...copyReal, rol: NO_ENCONTRADO });
    expect(mensaje).not.toContain(NO_ENCONTRADO);
    expect(mensaje).toBe(mensajeNoEncontrado("Naomi Couriel"));
  });

  it("con NO_ENCONTRADO no pide la foto todavía: primero se resuelve el rol", () => {
    const mensaje = mensajeCopy("Naomi Couriel", { ...copyReal, rol: NO_ENCONTRADO });
    expect(mensaje).not.toContain(PEDIDO_DE_FOTO);
  });

  // `pedirFoto: false` cubre dos casos del turno 2: la foto ya vino adjunta
  // al mismo mensaje que el nombre, o ya se validó antes y esto es una
  // corrección de texto.
  it("con pedirFoto:false no pide la foto aunque haya copy", () => {
    const mensaje = mensajeCopy("Naomi Couriel", copyReal, { pedirFoto: false });
    expect(mensaje).toContain(copyReal.rol);
    expect(mensaje).not.toContain(PEDIDO_DE_FOTO);
  });

  it("sin opciones sigue pidiendo la foto (compatibilidad con el turno 1)", () => {
    expect(mensajeCopy("Naomi Couriel", copyReal)).toContain(PEDIDO_DE_FOTO);
  });
});

describe("mensajeErrorBusqueda", () => {
  it("por default dice 'armar' (turno 1, buscarCopy)", () => {
    const mensaje = mensajeErrorBusqueda("Naomi Couriel");
    expect(mensaje).toContain("Naomi Couriel");
    expect(mensaje).toContain("armar el copy");
  });

  it("con 'rehacer' cambia el verbo (turno 2, rehacerCopy)", () => {
    const mensaje = mensajeErrorBusqueda("Naomi Couriel", "rehacer");
    expect(mensaje).toContain("rehacer el copy");
    expect(mensaje).not.toContain("armar el copy");
  });
});

describe("extraerFotoAdjunta", () => {
  const imagenUtil: Attachment = {
    type: "image",
    url: "https://files.slack.com/foto.jpg",
    fetchData: async () => Buffer.from(""),
  };

  it("sin attachments devuelve undefined", () => {
    expect(extraerFotoAdjunta(undefined)).toBeUndefined();
  });

  it("con un array vacío devuelve undefined", () => {
    expect(extraerFotoAdjunta([])).toBeUndefined();
  });

  it("ignora adjuntos que no son imagen", () => {
    const archivo: Attachment = {
      type: "file",
      url: "https://files.slack.com/cv.pdf",
      fetchData: async () => Buffer.from(""),
    };
    expect(extraerFotoAdjunta([archivo])).toBeUndefined();
  });

  // Sin `url` no hay nada que guardar en el estado para la Task 23 — no
  // alcanza con que sea de tipo "image".
  it("ignora una imagen sin url", () => {
    const sinUrl: Attachment = { type: "image", fetchData: async () => Buffer.from("") };
    expect(extraerFotoAdjunta([sinUrl])).toBeUndefined();
  });

  it("ignora una imagen sin fetchData", () => {
    const sinFetch: Attachment = { type: "image", url: "https://files.slack.com/foto.jpg" };
    expect(extraerFotoAdjunta([sinFetch])).toBeUndefined();
  });

  it("devuelve la imagen cuando tiene url y fetchData", () => {
    expect(extraerFotoAdjunta([imagenUtil])).toBe(imagenUtil);
  });

  // No alcanza con mirar el primer elemento: tiene que recorrer el array.
  it("encuentra la imagen aunque no sea el primer adjunto", () => {
    const archivo: Attachment = { type: "file", url: "https://files.slack.com/cv.pdf" };
    expect(extraerFotoAdjunta([archivo, imagenUtil])).toBe(imagenUtil);
  });
});

describe("listoParaFecha", () => {
  const copyReal: Copy = {
    rol: "AI Engineering en UdeSA y Data & AI en Ualá",
    genero: "f",
    fuentes: [],
  };

  it("con un rol resuelto, está listo", () => {
    expect(listoParaFecha(copyReal)).toBe(true);
  });

  // Con NO_ENCONTRADO todavía no hay a qué se dedica la persona — no tiene
  // sentido ofrecer el botón aunque la foto ya esté validada.
  it("con NO_ENCONTRADO, no está listo", () => {
    expect(listoParaFecha({ ...copyReal, rol: NO_ENCONTRADO })).toBe(false);
  });
});

describe("ID_BOTON_FECHA", () => {
  // Literal exacto que pide el brief — el handler de la Task 23 lo matchea.
  it("es 'cargar-datos'", () => {
    expect(ID_BOTON_FECHA).toBe("cargar-datos");
  });
});

describe("mensajeFotoSinCopy", () => {
  // El Critical de la review de la Task 22: con la foto válida y el copy en
  // NO_ENCONTRADO no se publicaba nada, y para el humano eso es idéntico al
  // bug que motivó el turno 2 — mandó algo y no pasó nada.
  it("confirma que guardó la foto", () => {
    expect(mensajeFotoSinCopy("Naomi Couriel")).toContain("Foto guardada");
  });

  it("pide el dato que falta, nombrando a la persona", () => {
    expect(mensajeFotoSinCopy("Naomi Couriel")).toContain("Naomi Couriel");
  });

  it("no filtra el literal del protocolo", () => {
    expect(mensajeFotoSinCopy("Naomi Couriel")).not.toContain(NO_ENCONTRADO);
  });
});

describe("NO_ENTENDI", () => {
  it("dice qué mandar en vez de solo avisar que falló", () => {
    expect(NO_ENTENDI).toMatch(/JPG|PNG/);
  });
});

describe("CALLBACK_ID_MODAL_FECHA / TITULO_MODAL_FECHA", () => {
  it("el título entra en el límite de 24 caracteres de un modal de Slack", () => {
    expect(TITULO_MODAL_FECHA.length).toBeLessThanOrEqual(24);
  });

  it("el callback id del modal no es igual al id del botón (son cosas distintas)", () => {
    expect(CALLBACK_ID_MODAL_FECHA).not.toBe(ID_BOTON_FECHA);
  });
});

describe("mensajeGenerando", () => {
  it("nombra a la persona y avisa que puede tardar", () => {
    const mensaje = mensajeGenerando("Naomi Couriel");
    expect(mensaje).toContain("Naomi Couriel");
    expect(mensaje).toMatch(/tardar|segundos/);
  });
});

describe("mensajePlacaLista", () => {
  it("nombra a la persona", () => {
    expect(mensajePlacaLista("Naomi Couriel")).toContain("Naomi Couriel");
  });
});

describe("mensajeSinFotoParaPlaca", () => {
  it("nombra a la persona y menciona el botón para volver a intentar", () => {
    const mensaje = mensajeSinFotoParaPlaca("Naomi Couriel");
    expect(mensaje).toContain("Naomi Couriel");
    expect(mensaje).toContain(TEXTO_BOTON_FECHA);
  });
});

describe("mensajeErrorPlaca", () => {
  it("traduce un error de descarga (prefijo 'descarga:') a texto sin HTTP ni URLs", () => {
    const crudo = new Error("descarga: HTTP 404 en https://files.slack.com/foto.jpg");
    const mensaje = mensajeErrorPlaca("Naomi Couriel", crudo);

    expect(mensaje).toContain("Naomi Couriel");
    // La causa técnica no tiene que llegar al canal tal cual.
    expect(mensaje).not.toContain("HTTP 404");
    expect(mensaje).not.toContain("https://files.slack.com/foto.jpg");
  });

  it("un mensaje humano de recortar()/recortarASilueta() se publica tal cual, sin prefijo 'descarga:'", () => {
    const humano = new Error(
      "No pude recortar el fondo de esa foto. Probá con otra, preferentemente con el fondo más despejado.",
    );
    expect(mensajeErrorPlaca("Naomi Couriel", humano)).toBe(humano.message);
  });

  it("un error sin mensaje (no es Error) cae en un texto genérico, no revienta", () => {
    const mensaje = mensajeErrorPlaca("Naomi Couriel", "algo no-Error");
    expect(mensaje).toContain("Naomi Couriel");
    expect(mensaje.length).toBeGreaterThan(0);
  });
});

describe("nombreArchivoPlaca", () => {
  // Valor fijo, no derivado de la función que se está probando: mutar el
  // slugificado tiene que romper esto.
  it("arma un slug ascii en minúsculas, sin acentos ni espacios", () => {
    expect(nombreArchivoPlaca("Naomi Couriel")).toBe("placa-naomi-couriel.png");
  });

  it("saca los acentos", () => {
    expect(nombreArchivoPlaca("Ñawi Núñez")).toBe("placa-nawi-nunez.png");
  });

  it("siempre termina en .png", () => {
    expect(nombreArchivoPlaca("Naomi Couriel")).toMatch(/\.png$/);
  });
});

describe("erroresModalFecha", () => {
  it("mapea fecha y hora vacíos a un error por campo", () => {
    const resultado = PlacaSchema.safeParse({ ...DATOS_DEMO, fecha: "", hora: "" });
    if (resultado.success) throw new Error("fixture inválido: se esperaba que fallara");

    const errores = erroresModalFecha(resultado.error);
    expect(errores).toHaveProperty("fecha");
    expect(errores).toHaveProperty("hora");
  });

  it("no inventa un error de fecha/hora si esos campos son válidos", () => {
    // Fuerza una falla en un campo que no es del modal (fotoElegida.url mal
    // formada) para confirmar que fecha/hora no aparecen sin motivo.
    const resultado = PlacaSchema.safeParse({
      ...DATOS_DEMO,
      fotoElegida: { ...DATOS_DEMO.fotoElegida, url: "no-es-una-url" },
    });
    if (resultado.success) throw new Error("fixture inválido: se esperaba que fallara");

    expect(erroresModalFecha(resultado.error)).toEqual({});
  });
});
