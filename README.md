# LifeLine

**Organiza. Registra. Avanza.**

Un espacio personal que conecta la planificación, la organización, el seguimiento y el registro de la vida cotidiana. No busca organizar cada minuto ni medir el rendimiento: busca dar una perspectiva global, continuidad a los objetivos y un registro del camino recorrido.

App en vivo: https://alvaromolmateo-cmd.github.io/life-line/

## Qué incluye la versión 1.0

Todos los apartados del planteamiento inicial, más categorías con subcategorías. Cada apartado responde a una pregunta y todos trabajan sobre la misma información.

| Apartado | Para qué sirve |
| --- | --- |
| **Inicio** | Visión general: tu día, calendario, tareas pendientes, próximos eventos, proyectos activos, bandeja de entrada y actividad reciente. Cada bloque se puede ocultar o recolocar desde «Personalizar». |
| **Calendario** | Eventos, citas, exámenes, entregas y fechas importantes, cada tipo con su color. Vistas de mes, semana y día. Muestra también las tareas con fecha límite y admite una anotación libre por día. Cada entrega crea su propia tarea, con el día de la entrega como fecha límite: se marca en Tareas cuando se entregue, antes de ese día o después, y pasado ese día queda atrasada. |
| **Tareas** | Pendientes agrupadas por fecha (atrasadas, hoy, próximos 7 días, más adelante, sin fecha), con estado, prioridad, categoría, proyecto y etiquetas. Incluye la bandeja de entrada y el historial de tareas hechas. |
| **Proyectos** | Descripción, objetivo, estado, prioridad y fechas. Cada ficha reúne sus tareas, sus notas, ideas y avances, sus eventos y su historial. |
| **Sprints** | Planificación semanal opcional. Cada semana puede tener un sprint con su objetivo y una selección de tareas tomadas de la lista general o de los proyectos. Un tablero las reparte en pendientes, en curso y hechas, y al cerrar la semana se guarda una revisión de lo conseguido y una reflexión. El historial conserva todos los sprints. |
| **Diario** | Entradas libres, sin formulario. Se escribe directamente en la página o desde cualquier día del calendario. Cada entrada puede llevar título, categoría, etiquetas, la marca de momento importante y un enlace a un proyecto o a un evento. Se consulta de la más reciente a la más antigua, con búsqueda y filtros por fecha, categoría y proyecto. |
| **Registros** | Lo ocurrido por semana, mes o año. El resumen cuenta tareas hechas, eventos, entradas del diario, avances y sprints, con un gráfico de tareas hechas, el reparto por categoría y los proyectos con movimiento. La cronología lo ordena día a día y la actividad enseña el historial completo de cambios. Todo en cantidades, sin porcentajes. |
| **Ajustes** | Nombre, tema claro u oscuro, cómo se organiza LifeLine, uso de los sprints, categorías y subcategorías, copia y restauración de los datos e instalación. |

Y de forma transversal:

- **Bandeja de entrada** – Se apunta cualquier cosa sin decidir dónde va; después se convierte en tarea, evento, proyecto, nota de un proyecto o entrada del diario.
- **Buscador global** – `Ctrl K` o `/`. Encuentra tareas, proyectos, eventos, sprints, entradas del diario, notas y apuntes sin recordar dónde se guardaron.
- **Historial real** – Cada alta, cada tarea completada y cada cambio de estado deja un apunte con su fecha.
- **Categorías y subcategorías** – Cada categoría puede tener subcategorías, como las asignaturas dentro de Estudios, cada una con su color y su prioridad. La prioridad ordena las subcategorías y se propone a las tareas nuevas que la usen. Filtrar por una categoría incluye sus subcategorías, y los registros las desglosan.
- **PWA** – Se instala en el móvil y en el ordenador y funciona sin conexión.

## Cómo encajan los sprints

| Apartado | Pregunta que responde |
| --- | --- |
| Calendario | Cuándo ocurren las cosas. |
| Tareas y proyectos | Qué hay que hacer y qué quieres conseguir. |
| Sprints | En qué quieres avanzar esta semana. |
| Diario | Qué ha ocurrido y cómo lo has vivido. |
| Registros | Qué has hecho y cómo ha ido cambiando con el tiempo. |

Un sprint es una semana con intención: un objetivo y unas pocas tareas elegidas. No crea nada nuevo ni duplica nada, solo señala tareas que ya existen, así que el resto de la app funciona igual se usen o no.

- **Con sprints** – Se planifica al empezar la semana, se sigue el tablero y se cierra con una revisión y una reflexión. Inicio enseña el sprint en curso y las tareas elegidas llevan la etiqueta Sprint.
- **Sin sprints** – Se organiza por fechas, prioridades y proyectos. Desde Ajustes se pueden desactivar: desaparecen del menú, de Inicio, de las fichas, del buscador y de los registros, y lo planificado se conserva para cuando se vuelvan a activar.
- **A ratos** – Una semana sin sprint es una semana normal. Se puede planificar solo la que lo pida.

La misma explicación está dentro de la app, en Ajustes.

## Hoja de ruta

El desarrollo es progresivo: cada etapa se apoya en la anterior y ningún módulo es obligatorio para usar los demás.

1. **Base, Calendario, Tareas y Proyectos** – Hecho en la versión 0.1.
2. **Sprints** – Hecho en la versión 0.2. Todo con nombres en español: lista general, planificar, tareas de la semana, revisión y reflexión.
3. **Diario y Registros** – Hecho en la versión 0.3, junto con el interruptor de los sprints.
4. **Subcategorías y versión 1.0** – Primera versión completa.
5. **Ahora** – Uso real y revisiones a partir de lo que se vaya viendo.
6. **Más adelante** – Hábitos y rutinas, objetivos a largo plazo, recordatorios, adjuntos y sincronización entre dispositivos.

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
js/forms.js             Formularios de tarea, evento, proyecto, entrada del diario y categoría; organizar la bandeja
js/search.js            Buscador global
js/views/*.js           Una vista por apartado: inicio, calendario, tareas, proyectos, sprints, diario, registros, ajustes
sw.js                   Service worker: red primero, caché si falla
tools/make-icons.js     Genera los iconos PNG con Node, sin dependencias
```

Cada vista exporta `render(ctx)`, que devuelve HTML, y `mount(root, ctx)`, que conecta sus eventos. Cualquier cambio pasa por una acción de `store.js`, que guarda y vuelve a pintar. Las acciones comunes se declaran con `data-act` y las atiende `app.js` en un único punto.

## Datos y relaciones

Cada cosa se guarda una sola vez y se relaciona por identificador. Una tarea puede pertenecer a un proyecto, tener categoría y aparecer en el calendario por su fecha límite sin que exista ninguna copia.

```
categories   { id, name, color, order, parentId, priority }
inbox        { id, text, createdAt }
tasks        { id, title, notes, status, priority, due, categoryId, projectId, tags[], createdAt, completedAt }
projects     { id, title, description, goal, status, priority, start, end, categoryId, tags[],
               entries[{ id, kind, text, at }], createdAt, completedAt }
events       { id, title, type, date, start, end, place, notes, categoryId, projectId, taskId, createdAt }
sprints      { id, start, goal, taskIds[], review, reflection, result[{ id, title, done, completedAt }],
               createdAt, closedAt }
journal      { id, date, title, text, starred, categoryId, projectId, eventId, tags[], createdAt, updatedAt }
dayNotes     { 'AAAA-MM-DD': texto }
activity     { id, at, action, kind, refId, title, projectId }
settings     { name, theme, calendarMode, useSprints, dashboard[{ id, on }] }
```

- `tasks.status` – `pending`, `doing` o `done`. `events.type` – `event`, `appointment`, `exam`, `delivery` o `date`. `entries.kind` – `note`, `idea` o `progress`.
- Una entrega (`events.type` = `delivery`) va unida a su tarea por `taskId`. El evento marca la fecha y la tarea es la que se hace: aparece en Tareas, cuenta en el proyecto y puede ir a un sprint. Comparten título, notas, categoría, proyecto y fecha (la fecha del evento es la fecha límite de la tarea); se cambie desde donde se cambie, el otro lado se actualiza. Borrar uno borra el otro. Si el evento deja de ser una entrega, su tarea se queda como una tarea más. Al pasar a la versión 5 de los datos, cada entrega que ya existía se une a la tarea con el mismo título y fecha límite si la había, o se le crea una.
- Un sprint es una semana de lunes a domingo y `sprints.start` es su lunes; hay como mucho uno por semana. Guarda solo los identificadores de sus tareas, así que una tarea sigue siendo única aunque esté en un proyecto, en el calendario y en la semana. Su estado sale de las fechas: planificado, en curso, por revisar o cerrado.
- Al cerrar un sprint, `result` guarda cómo quedó cada tarea con el título que tenía, para que el historial se siga entendiendo aunque la tarea cambie o se borre. Las tareas abiertas pueden pasar al sprint de la semana siguiente.
- Una categoría con `parentId` es una subcategoría de esa categoría principal. Hay un solo nivel. Al borrar una subcategoría, lo clasificado en ella pasa a su categoría principal; al borrar una principal se borran también sus subcategorías y lo clasificado queda sin categoría.
- Una entrada del diario solo necesita su día y su texto. Si se borra el proyecto, el evento o la categoría a los que apuntaba, la entrada se conserva sin ese enlace. En el historial figura por su título o por su día, nunca por lo escrito.
- Los registros no guardan nada propio: se calculan en el momento a partir de las tareas, los eventos, el diario, los proyectos y los sprints.

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
