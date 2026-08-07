# Video Pitch — Segmento: Extracción de datos con la extensión
**Participante:** [Nombre del integrante responsable de frontend/extensión]  
**Duración:** ~60 segundos (Demostración funcional)  
**Contexto:** Este segmento forma parte de la sección 3 "Demostración" del video pitch general (2 minutos).

---

## 🎬 GUION — "Cómo extraer datos de e-commerce con nuestra extensión"

### [00:00 – 00:05] **Introducción a la herramienta**

> *[Mostrar pantalla con extensión instalada en Chrome/Brave]*
>
> "Hemos creado una extensión de Chrome que automatiza la extracción de datos de e-commerce en tiempo real. 
> El usuario no necesita código ni configuración manual: la extensión hace todo el trabajo."

---

### [00:05 – 00:20] **Paso 1: Instalar y activar la extensión**

> *[Mostrar el ícono de la extensión en la barra del navegador]*
>
> "Una vez instalada, la extensión está lista. Simplemente vamos a un sitio de e-commerce como Temu, Amazon o Shein,
> y activamos la extensión con un click."
>
> *[Click en el ícono de la extensión → se abre el panel lateral]*

---

### [00:20 – 00:35] **Paso 2: Mapear campos automáticamente (extractAll mode)**

> *[La extensión muestra un panel con opciones de extracción]*
>
> "La extensión ofrece dos modos de extracción:
> 
> **Modo Automático (extractAll):** Simplemente seleccionamos un contenedor de producto 
> — digamos, una tarjeta con precio, imagen y título — y la extensión detecta automáticamente 
> todos los campos relevantes."
>
> *[Click en un producto en la página → la extensión lo resalta]*
>
> "La extensión inteligentemente captura:
> - **Título del producto**
> - **Precio** (incluso cuando está fragmentado en múltiples elementos, como en Temu)
> - **Imagen**
> - **URL del producto**
> - **Categoría**
> - **Calificación**"

---

### [00:35 – 00:45] **Paso 3: Detección inteligente de precios (Hybrid Approach)**

> *[Mostrar un producto en Temu con precio fragmentado: $ | 267 | ,88]*
>
> "Una característica clave: nuestra extensión usa detección de precios por **patrón**. 
> Esto significa que detecta el símbolo de moneda ($, €, £) y busca números asociados,
> incluso si están en elementos HTML separados."
>
> *[El campo de precio se llena correctamente con: 267.88]*
>
> "En tiendas como Temu, el precio viene fragmentado en múltiples spans. 
> Nuestro algoritmo lo une y lo parsea correctamente: **$267.88** (no 4.7 como una calificación)."

---

### [00:45 – 00:55] **Paso 4: Vista previa y validación**

> *[La extensión muestra un preview de los productos extraídos]*
>
> "Una vez extraídos, el usuario ve un preview en tiempo real con todos los campos capturados.
> Puede revisar, editar o descartar datos antes de enviarlos al sistema."
>
> *[Navegar entre productos con flechas (prev/next)]*
>
> "Si un campo no se detectó correctamente, puede editarlo manualmente,
> o simplemente enviar a la siguiente tienda."

---

### [00:55 – 01:00] **Paso 5: Exportar y almacenar**

> *[Click en botón 'Enviar' o 'Exportar']*
>
> "Cuando está listo, exporta los datos en formato JSON estructurado.
> Nuestro backend los procesa, valida contra reglas de negocio,
> y los almacena en la base de datos operacional."
>
> *[Mostrar JSON exportado brevemente]*

---

## 📊 **Puntos clave para enfatizar (Credibilidad técnica)**

1. **Automatización sin código** — El usuario no escribe selectores CSS; la extensión lo hace.
2. **Detección de precios robusta** — Maneja Temu, Amazon, Shein sin configuración especial.
3. **Filtrado inteligente de rating** — Evita confundir calificaciones (4.7 ⭐) con precios.
4. **Arquitectura limpia** — Datos fluyen: Extensión → Backend → DB operacional → Data Warehouse.

---

## 🎥 **Recomendaciones técnicas para la grabación**

- **Velocidad:** Mantén un ritmo tranquilo; los viewers necesitan ver cada paso.
- **Audio:** Habla claro, describe lo que ves mientras cliqueas.
- **Pantalla:** Zoom 125–150% para que los textos se vean legibles en la video.
- **Navegador:** Usa Brave o Chrome limpio (sin muchas extensiones distractoras).
- **Tienda de demostración:** Recomendado Temu (para mostrar el precio fragmentado) o Amazon (para fallback selector-based).

---

## ⏱️ **Timing breakdown**

| Subsección | Duración | Acción |
|------------|----------|--------|
| Introducción | 5 s | Hablar del propósito |
| Instalación | 15 s | Mostrar ícono, activar extensión |
| Mapeo automático | 15 s | Seleccionar contenedor, ver campos detectados |
| Detección de precios | 10 s | Destacar el precio fragmentado y cómo se une |
| Vista previa | 10 s | Navegar productos, revisar datos |
| Exportar | 5 s | Click de envío, mostrar JSON |
| **TOTAL** | **60 s** | ✅ |

---

## 📝 **Notas de dirección para el integrante**

- **Tono:** Profesional pero accesible. Estás demostrando un producto, no dando una charla técnica.
- **Gestos:** Señala con el cursor lo que estás haciendo.
- **Pauses:** Haz pauses después de cada acción importante para que se vea claramente.
- **Cierre:** Termina diciendo: *"Eso es todo. Desde aquí, los datos fluyen automáticamente al análisis de inteligencia de negocios."*

---

## ✅ **Checklist de grabación**

- [ ] Extensión instalada y funcionando
- [ ] Navegador a 125–150% zoom
- [ ] Micrófono probado (audio limpio sin ruidos de fondo)
- [ ] Conexión de internet estable (la tienda de demostración carga rápido)
- [ ] Datos precargados o tienda disponible para demostración en vivo
- [ ] Grabación en resolución 1080p mínimo
- [ ] Subtítulos generados o transcripción disponible
