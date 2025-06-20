## Requisitos del proyecto
- Cuenta de Google con acceso a Gmail y Google Drive.

## Como ejecutar el proyecto

### Configuración
- Crear un nuevo proyecto en [Google Apps Script](https://script.google.com).
- En la ventana de `Editor`, pulsar `New Script File` y crear los archivos `main.gs`, `pluralize.gs`, `spelling.gs`.
- Copiar el contenido de los archivos `main.gs`, `pluralize.gs` y `spelling.gs` desde el repositorio a los archivos recién creados.
- En la ventana de `Project Settings`, activar `Show "appsscript.json" manifest file in editor`.
- Copiar el contenido del archivo `appsscript.json` desde el repositorio al archivo `appsscript.json` revelado.
- En la ventana de `Project Settings`, agregar en `Script Properties` la siguiente propiedad:
  - `SEARCH_KEYWORDS`: `PALABRAS_CLAVE` donde `PALABRAS_CLAVE` es una lista de palabras clave separadas por espacio que se utilizarán para consultar los correos electrónicos. Por ejemplo: `pasantia`.
- Ejecutar el script una vez para autorizar el acceso a la API de Gmail y Google Drive. La ejecución puede ser manual o mediante un trigger.

### Ejecución manual
- En la ventana de `Editor`, pulsar `Run` con la función `main` seleccionada.

### Ejecución por trigger
- En la ventana de `Triggers`, pulsar `Add Trigger` para crear un nuevo trigger.
- Agregar la configuración deseada. Normalmente es:
  - Function: `main`
  - Deployment: `Head`
  - Event source: `Time-driven`
  - Type of time based trigger: `Hour timer`
  - Hour interval: `Every hour`
- Pulsar `Save` para guardar el trigger.

## Consideraciones
- Al consultar hilos de correos, se repiten los archivos adjuntos obtenidos. Estos archivos no se descartan para permitir que existan ediciones del archivo con el mismo nombre dentro del hilo. Sin embargo, puede llevar a duplicados si la edición no ocurre.