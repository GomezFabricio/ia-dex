# Notas para el Informe

## §13.6 — Heurística de Recomendación

La heurística de recomendación es deliberadamente simple, acorde al alcance del trabajo. Combina dos señales: (1) popularidad por vistas — la vista SQL `v_software_populares` acumula eventos de tipo "vista" por software; las recomendaciones al ingresar muestran el top global ordenado por vistas descendentes; (2) afinidad temática — en la ficha de un software se recomiendan otros del mismo tema, también ordenados por vistas, excluyendo el software actual. Como estrategia de arranque en frío, si aún no hay vistas registradas el sistema devuelve el catálogo ordenado alfabéticamente, de modo que la sección nunca quede vacía mientras exista contenido cargado.
