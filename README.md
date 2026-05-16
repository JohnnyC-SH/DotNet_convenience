# .NET Convenience

Extensión para **Visual Studio Code** y **Cursor** que añade atajos para flujos habituales de **.NET** (complementa C# Dev Kit y el SDK).

Repositorio: [github.com/t1gr3ju4nmx/DotNet_convenience](https://github.com/t1gr3ju4nmx/DotNet_convenience)

**Donar (PayPal — SIPTec):** [https://paypal.me/SIPTec](https://paypal.me/SIPTec)

*(En instalaciones por `.vsix`, Cursor/VS Code a veces **no muestra** el botón “Sponsor” del `package.json`; el enlace de arriba es el que siempre funciona.)*

## Capturas

Las rutas son **relativas al paquete** para que carguen en la ficha de la extensión al instalar desde VSIX.

![Paleta de comandos con prefijo .NET](docs/screenshots/paleta-comandos.png)

![Menú contextual en el explorador](docs/screenshots/menu-explorador.png)

## Requisitos

- [.NET SDK](https://dotnet.microsoft.com/download) instalado y en el `PATH`.
- Node.js solo si vas a **compilar** o **empaquetar** la extensión desde el código fuente.

## Comandos (paleta: `Cmd+Shift+P` / `Ctrl+Shift+P`)

Busca el prefijo **`.NET:`**.

| Comando | Descripción breve |
|--------|-------------------|
| Agregar clase C# | Crea un `.cs` con namespace inferido. |
| Agregar interfaz C# | Crea una interfaz en el namespace del proyecto. |
| Agregar componente Razor | Crea un `.razor` con `@namespace`. |
| Agregar página Razor con `@page` | Crea una página con ruta configurable. |
| Agregar controller (API o MVC) | Web API (`ControllerBase`) o MVC (`Controller`). |
| Agregar referencia a otro proyecto | Ejecuta `dotnet add … reference …`. |
| Nuevo proyecto en la solución | `dotnet new` y `dotnet sln add`. |

También hay entradas en el **menú contextual** del explorador de archivos (carpetas y archivos `.cs` / `.razor`).

## Desarrollo

```bash
git clone https://github.com/t1gr3ju4nmx/DotNet_convenience.git
cd DotNet_convenience
npm install
npm run compile
```

Empaquetar como `.vsix`:

```bash
npx @vscode/vsce package
```

Instalar en Cursor/VS Code:

```bash
cursor --install-extension dotnet-convenience-0.2.5.vsix
# o: code --install-extension …
```

Si antes instalaste la versión con publisher **`local`**, desinstala el duplicado (es otro id de extensión):

```bash
cursor --uninstall-extension local.dotnet-convenience
```

*(Ajusta el nombre del archivo `.vsix` a la versión actual del `package.json`.)*

## Colaboración

- **Issues:** [problemas y ideas](https://github.com/t1gr3ju4nmx/DotNet_convenience/issues).
- **Pull requests:** bifurca el repo, crea una rama con tu cambio y abre un PR contra `main` (o la rama por defecto del repo).

## Donaciones

Mismo enlace que arriba: [paypal.me/SIPTec](https://paypal.me/SIPTec)

*(La página `paypal.com/.../my/profile` es solo tu perfil al entrar en PayPal; para compartir cobros usa **PayPal.me**.)*

## Licencia

MIT — ver `LICENSE` en esta carpeta.

---

*Puedes ampliar este README con capturas, enlace al Marketplace y guías de uso.*
