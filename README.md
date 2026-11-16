# LifeLine

**Organiza. Registra. Avanza.**

Un espacio personal que conecta la planificación, la organización, el seguimiento y el registro de la vida cotidiana. No busca organizar cada minuto ni medir el rendimiento: busca dar una perspectiva global, continuidad a los objetivos y un registro del camino recorrido.

App en vivo: https://alvaromolmateo-cmd.github.io/life-line/

## Qué incluye la versión 0.2

La base y los módulos que responden a «cuándo ocurren las cosas», «qué hay que hacer» y «en qué quiero avanzar esta semana».

| Apartado | Para qué sirve |
| --- | --- |
| **Inicio** | Visión general: tu día, calendario, tareas pendientes, próximos eventos, proyectos activos, bandeja de entrada y actividad reciente. Cada bloque se puede ocultar o recolocar desde «Personalizar». |
| **Calendario** | Eventos, citas, exámenes, entregas y fechas importantes, cada tipo con su color. Vistas de mes, semana y día. Muestra también las tareas con fecha límite y admite una anotación libre por día. |
| **Tareas** | Pendientes agrupadas por fecha (atrasadas, hoy, próximos 7 días, más adelante, sin fecha), con estado, prioridad, categoría, proyecto y etiquetas. Incluye la bandeja de entrada y el historial de tareas hechas. |
| **Proyectos** | Descripción, objetivo, estado, prioridad y fechas. Cada ficha reúne sus tareas, sus notas, ideas y avances, sus eventos y su historial. |
| **Sprints** | Planificación semanal opcional. Cada semana puede tener un sprint con su objetivo y una selección de tareas tomadas de la lista general o de los proyectos. Un tablero las reparte en pendientes, en curso y hechas, y al cerrar la semana se guarda una revisión de lo conseguido y una reflexión. El historial conserva todos los sprints. |
| **Ajustes** | Nombre, tema claro u oscuro, categorías configurables, copia y restauración de los datos e instalación. |

Y de forma transversal:

- **Bandeja de entrada** – Se apunta cualquier cosa sin decidir dónde va; después se convierte en tarea, evento, proyecto o nota de un proyecto.
- **Buscador global** – `Ctrl K` o `/`. Encuentra tareas, proyectos, eventos, sprints, notas y apuntes sin recordar dónde se guardaron.
- **Historial real** – Cada alta, cada tarea completada y cada cambio de estado deja un apunte con su fecha.
- **PWA** – Se instala en el móvil y en el ordenador y funciona sin conexión.

## Hoja de ruta

El desarrollo es progresivo: cada etapa se apoya en la anterior y ningún módulo es obligatorio para usar los demás.

1. **Base, Calendario, Tareas y Proyectos** – Hecho en la versión 0.1.
2. **Sprints** – Hecho en la versión 0.2. Todo con nombres en español: lista general, planificar, tareas de la semana, revisión y reflexión.
3. **Diario** – Entradas libres, sin formulario, con historial cronológico, búsqueda y relación opcional con proyectos y eventos.
4. **Registros** – Historial y evolución: tareas completadas, evolución de proyectos, sprints anteriores y resúmenes por periodo.
5. **Más adelante** – Hábitos y rutinas, objetivos a largo plazo, recordatorios, adjuntos y sincronización entre dispositivos.

## Arquitectura

PWA sin paso de compilación y sin dependencias: HTML, CSS y módulos de JavaScript servidos tal cual desde GitHub Pages.

```
index.html              Estructura, iconos SVG y barra de navegación
css/styles.css          Estilos, tema claro y oscuro, móvil y escritorio
js/app.js               Arranque, rutas por hash, acciones globales, tema, instalación
js/store.js             Estado, guardado en localStorage, acciones y red de seguridad
js/query.js             Consultas de solo lectura, índices por día y buscador
js/dates.js             Fechas locales, semanas de lunes a domingo y formatos en español
js/ui.js                Modal, menú, avisos y utilidades de interfaz
js/components.js        Filas de tarea y de evento, etiquetas y tarjetas compartidas
js/forms.js             Formularios de tarea, evento, proyecto y categoría; organizar la bandeja
js/search.js            Buscador global
js/views/*.js           Una vista por apartado: inicio, calendario, tareas, proyectos, sprints, ajustes
sw.js                   Service worker: red primero, caché si falla
tools/make-icons.js     Genera los iconos PNG con Node, sin dependencias
```

Cada vista exporta `render(ctx)`, que devuelve HTML, y `mount(root, ctx)`, que conecta sus eventos. Cualquier cambio pasa por una acción de `store.js`, que guarda y vuelve a pintar. Las acciones comunes se declaran con `data-act` y las atiende `app.js` en un único punto.

## Datos y relaciones

Cada cosa se guarda una sola vez y se relaciona por identificador. Una tarea puede pertenecer a un proyecto, tener categoría y aparecer en el calendario por su fecha límite sin que exista ninguna copia.

```
categories   { id, name, color, order }
inbox        { id, text, createdAt }
tasks        { id, title, notes, status, priority, due, categoryId, projectId, tags[], createdAt, completedAt }
projects     { id, title, description, goal, status, priority, start, end, categoryId, tags[],
               entries[{ id, kind, text, at }], createdAt, completedAt }
events       { id, title, type, date, start, end, place, notes, categoryId, projectId, createdAt }
sprints      { id, start, goal, taskIds[], review, reflection, result[{ id, title, done, completedAt }],
               createdAt, closedAt }
dayNotes     { 'AAAA-MM-DD': texto }
activity     { id, at, action, kind, refId, title, projectId }
settings     { name, theme, calendarMode, dashboard[{ id, on }] }
```

- `tasks.status` – `pending`, `doing` o `done`. `events.type` – `event`, `appointment`, `exam`, `delivery` o `date`. `entries.kind` – `note`, `idea` o `progress`.
- Un sprint es una semana de lunes a domingo y `sprints.start` es su lunes; hay como mucho uno por semana. Guarda solo los identificadores de sus tareas, así que una tarea sigue siendo única aunque esté en un proyecto, en el calendario y en la semana. Su estado sale de las fechas: planificado, en curso, por revisar o cerrado.
- Al cerrar un sprint, `result` guarda cómo quedó cada tarea con el título que tenía, para que el historial se siga entendiendo aunque la tarea cambie o se borre. Las tareas abiertas pueden pasar al sprint de la semana siguiente.
- Las etapas siguientes se añaden sin tocar lo anterior: una entrada del diario guardará enlaces a proyectos o eventos.

### Los datos no se pierden

Todo vive en el `localStorage` del navegador, bajo la clave `lifeline:data`, que no debe cambiar de nombre.

- Cualquier cambio de estructura sube `DATA_VERSION` y se adapta en `migrate`, que conserva los campos que no conoce.
- Antes de adaptar datos de otra versión, y antes de restaurar una copia, se guarda lo que había en `lifeline:data:copia`.
- Si lo guardado no se puede leer, se aparta en `lifeline:data:rescate` y se puede descargar desde Ajustes.
- Desde Ajustes se descarga y se restaura una copia completa en JSON.

## Desarrollo

```
python -m http.server 5180
```

y abrir http://localhost:5180. Al cambiar archivos precacheados, subir a la vez `VERSION` en `sw.js` y `APP_VERSION` en `js/views/ajustes.js`.

Los iconos se regeneran con `node tools/make-icons.js`.
