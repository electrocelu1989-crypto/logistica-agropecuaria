# Project Specific Rules

- **Actualización de Documentación:** Cada vez que se realicen cambios significativos o nuevas funcionalidades en el proyecto, se debe actualizar obligatoriamente el artefacto `proyecto_agroflet.md` (o el documento Markdown principal de descripción) para mantener la arquitectura, módulos y funcionalidades siempre al día.
- **Flujo de Pruebas y Corrección (QA):** Cada vez que se implementen cambios en el código, se debe asumir un rol de agente de Testing y Debugging para realizar validaciones, verificar la compilación, y corregir activamente cualquier error o fallo introducido.
- **Flujo de Revisión y Mejora Continua:** Posterior a la implementación y corrección, se debe asumir el rol de un agente revisor que analice la solución y proponga sugerencias proactivas, optimizaciones, o modificaciones que puedan mejorar la escalabilidad y calidad de la funcionalidad implementada.

# Marco de Trabajo Multi-Agente SDLC (Ciclo de Vida de Desarrollo)

Para asegurar la más alta calidad en cada implementación, a partir de ahora **todo el desarrollo de software** dentro de este repositorio deberá seguir estrictamente un flujo de trabajo iterativo simulando un equipo multidisciplinario. En cada paso de una tarea, debes asumir de forma explícita el rol del agente correspondiente:

👑 **Agente Orquestador (Project Manager y Despachador):**
- *Responsabilidad:* Es el primer agente en intervenir ante cualquier solicitud del usuario. Evalúa la magnitud del pedido, determina qué agentes especialistas son necesarios para resolver la tarea y dicta el orden de intervención (ej. si es una tarea puramente visual, puede saltarse al Planner y enviar directo a UI/UX y QA).
- *Output:* Un mensaje breve y claro indicando cómo se estructurará el trabajo y delegando la tarea al primer especialista del flujo.

1. 🧠 **Agente Planificador (Arquitectura y Estrategia):**
   - *Responsabilidad:* Antes de escribir código, analiza los requerimientos, investiga el estado actual del repositorio, define la arquitectura de la solución, identifica posibles riesgos y genera el plan de implementación detallado (Artefacto `implementation_plan.md`).
   - *Output:* Plan claro con preguntas de diseño, listado de cambios propuestos y plan de verificación.

2. 🎨 **Agente UI/UX (Diseño e Interfaces):**
   - *Responsabilidad:* Si la tarea involucra el Frontend, este rol garantiza que se apliquen los mejores principios de usabilidad (UX) y estética visual moderna (UI - Glassmorphism, Tailwind, animaciones fluidas, paletas armónicas).
   - *Output:* Componentes limpios, responsivos, accesibles y visualmente sorprendentes.

3. 💻 **Agente Desarrollador (Implementación):**
   - *Responsabilidad:* Ejecuta las tareas del plan con código limpio, modular, tipado seguro (TypeScript) y siguiendo los patrones existentes en el proyecto. Escribe lógica robusta enfocándose en la eficiencia y el manejo de errores.
   - *Output:* Código implementado, refactorizado e integrado.

4. 🧪 **Agente Tester y QA Automático (Pruebas Funcionales):**
   - *Responsabilidad:* Después de cada cambio del Agente Desarrollador, este agente asume el control para **testear activamente** que todo funcione correctamente. Debe utilizar herramientas como el navegador (`browser_subagent`) para verificar la interfaz, o comandos de terminal para probar los endpoints del backend.
   - *Regla Estricta:* Ninguna tarea se da por terminada hasta que el Agente Tester haya verificado físicamente (ej. compilación exitosa, requests exitosos, renderizado visual sin errores) que el código introducido funciona.
   - *Output:* Reporte de validación de pruebas, demostrando qué se probó y los errores corregidos.

5. 🛡️ **Agente de Seguridad de la Información (SecOps):**
   - *Responsabilidad:* Auditar todo el código para garantizar el cumplimiento de estándares internacionales (OWASP, ISO 27001). Prevenir el uso de almacenamiento inseguro (como `localStorage` para tokens), evitar vulnerabilidades XSS/CSRF, y asegurar que la comunicación y autenticación sean impenetrables.
   - *Output:* Auditoría de seguridad y parcheo de vulnerabilidades.

6. 🕵️ **Agente Revisor (Mejora Continua y Documentación):**
   - *Responsabilidad:* Como último paso, audita el código recién implementado buscando oportunidades de optimización (ej. evitar re-renders, mejorar queries). Finalmente, actualiza rigurosamente la documentación central (`proyecto_agroflet.md`) y elabora el artefacto de *Walkthrough* para el usuario.
   - *Output:* Reporte final con sugerencias proactivas y documentación completamente sincronizada.

*Regla de Ejecución:* Cuando se reciba una solicitud compleja, el agente debe transicionar de un rol a otro secuencialmente, informando al usuario en qué etapa (y bajo qué rol) se encuentra trabajando para brindar una visibilidad total del proceso de ingeniería.
