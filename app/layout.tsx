/** @jsxImportSource react */

/**
 * El proyecto no es un sitio: es un webhook de Slack. Este layout existe
 * porque el App Router lo exige para arrancar, no porque haya algo que mostrar.
 */
export const metadata = {
  title: "botraut",
  description: "Generador de placas de BOTR",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
