# 📖 Guía de Usuario — WebScrapingDinamico-Automatico

**Versión**: 1.0  
**Última actualización**: 2026-07-21  
**Estado**: ✅ Proyecto funcional

---

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Acceso a la Aplicación](#acceso-a-la-aplicación)
3. [Instalación de la Extensión](#instalación-de-la-extensión)
4. [Flujo Principal: Visual Mapper](#flujo-principal-visual-mapper)
5. [Gestión de Productos](#gestión-de-productos)
6. [Gestión de Dominios](#gestión-de-dominios)
7. [Gestión de Categorías](#gestión-de-categorías)
8. [Dashboard y Analytics](#dashboard-y-analytics)
9. [Auto-Replay (Programación)](#auto-replay-programación)
10. [Casos de Uso](#casos-de-uso)
11. [Troubleshooting](#troubleshooting)

---

## 🎯 Introducción

**WebScrapingDinamico-Automatico** es una plataforma de web scraping visual que te permite:

✅ **Mapear campos visualmente** — sin escribir código  
✅ **Extraer productos automáticamente** — de cualquier e-commerce  
✅ **Guardar historial de precios** — monitoreo en tiempo real  
✅ **Programar extracciones** — auto-replay cada N horas  
✅ **Analizar datos** — KPIs, tendencias, outliers  

**Stack**:
- Frontend: Angular 22 (SPA responsive)
- Backend: NestJS 11 (API REST)
- Database: PostgreSQL (2 esquemas: operacional + analytics)
- Extension: Chrome MV3 (multi-navegador)

---

## 🔐 Acceso a la Aplicación

### 1.1 URL de Acceso

```
http://localhost:8080
```

### 1.2 Credenciales de Entrada

```
Email:    admin@example.com
Password: adminpassword
```

### 1.3 Proceso de Login

1. Abre http://localhost:8080 en tu navegador
2. Verás pantalla de login (esquina superior derecha)
3. Ingresa:
   - Email: `admin@example.com`
   - Password: `adminpassword`
4. Click en **"Sign In"** o presiona Enter
5. Redirige a **Visual Mapper** (página principal)

**Pantalla después del login**:
```
┌─────────────────────────────────────┐
│ 🏠 Logo    Visual Mapper ⚙️ Settings │  (Header)
├─────────────────────────────────────┤
│ SIDEBAR          │  CONTENIDO       │
│ ✓ Visual Mapper  │  [Mapeo visual]  │
│ • Products       │  [Campos]        │
│ • Domains        │  [Botones]       │
│ • Categories     │                  │
│ • Dashboard      │                  │
│ 🚪 Logout        │                  │
└─────────────────────────────────────┘
```

---

## 🔧 Instalación de la Extensión

La extensión Chrome es **obligatoria** para el mapeo visual. Aquí cómo instalarla en diferentes navegadores.

### 2.1 Verificar si la Extensión está Disponible

Cuando accedes a la app, en la esquina superior derecha verás un ícono:

```
┌──────────────────────┐
│ ✅ Extension Available │  ← Verde = extensión detectada
│ ❌ Extension Not Found │  ← Rojo = no instalada
└──────────────────────┘
```

Si dice "Not Found", sigue los pasos abajo.

---

### 2.2 Instalar en Chrome / Brave / Opera

#### Opción A: Desde la App (Recomendado)

1. Click en **"Settings"** (esquina superior derecha)
2. Click en **"Extension Setup"** o **"Extensión"**
3. Ves lista de navegadores soportados
4. Click en **"Download Chrome Extension"**
5. Se descarga archivo `.zip`
6. Descomprimir en carpeta (ej: `~/Downloads/extension-chrome/`)

#### Opción B: Cargar Manualmente en Chrome

1. Abre Chrome
2. Ve a: `chrome://extensions/`
3. Activa **"Modo de desarrollador"** (esquina superior derecha)
4. Click en **"Cargar extensión sin empaquetar"**
5. Selecciona carpeta descomprimida (`extension-chrome/`)
6. ✅ Extensión instalada

**Verificar**:
- En `chrome://extensions/` ves la extensión con nombre "Visual Scraper Extension"
- En la app, el ícono dice "✅ Extension Available"

---

### 2.3 Instalar en Firefox

#### Paso 1: Descargar

1. Click en **"Settings"** → **"Extension Setup"**
2. Click en **"Download Firefox Extension"**
3. Se descarga `firefox.zip`
4. Descomprimir en carpeta

#### Paso 2: Cargar en Firefox

1. Abre Firefox
2. Ve a: `about:debugging#/runtime/this-firefox`
3. Click en **"Cargar complemento temporal"**
4. Selecciona `manifest.json` de la carpeta descomprimida
5. ✅ Extensión cargada

**Nota**: En Firefox es temporal (se elimina al cerrar). Para permanente:
- Publica en Firefox Add-ons (requiere verificación)
- O sigue pasos para desarrollo

**Verificar**:
- En `about:addons` ves "Visual Scraper Extension"
- En la app, ícono muestra "✅ Extension Available"

---

### 2.4 Instalar en Edge

#### Paso 1: Descargar

1. Click en **"Settings"** → **"Extension Setup"**
2. Click en **"Download Edge Extension"**
3. Se descarga `edge.zip`
4. Descomprimir

#### Paso 2: Cargar en Edge

1. Abre Edge
2. Ve a: `edge://extensions/`
3. Activa **"Modo de desarrollador"** (esquina inferior izquierda)
4. Click en **"Cargar extensión sin empaquetar"**
5. Selecciona carpeta descomprimida
6. ✅ Extensión instalada

**Verificar**: En `edge://extensions/` ves la extensión

---

### 2.5 Instalar en Safari (macOS)

#### Paso 1: Preparar

Safari en macOS requiere Xcode. Alternativa: usa Chrome/Edge en macOS.

Si quieres intentar:
1. Click en **"Settings"** → **"Extension Setup"**
2. Click en **"Download Safari Extension"**
3. Descarga `safari.zip`

#### Paso 2: Cargar en Safari

1. Abre Safari
2. Ve a: `Preferencias` → `Extensiones`
3. Click en **"Permitir extensiones no firmadas"**
4. Arrastra archivo `.xcode-project` a Safari (requiere compilar)

**Recomendación**: Usa Chrome o Edge en Safari. Es más fácil.

---

### 2.6 Verificar que la Extensión Funciona

Una vez instalada, prueba esto:

1. Abre un sitio con productos (ej: Amazon, Mercado Libre)
2. En la app, click en **"Visual Mapper"**
3. Ingresa URL del sitio
4. Click en **"Open Extension Mapper"**
5. Se abre pestaña nueva con la extensión
6. Verás mensaje: **"Extension tab is open"** ✓

Si no funciona, ver [Troubleshooting](#troubleshooting).

---

## 📍 Flujo Principal: Visual Mapper

Este es el flujo central de la aplicación. Sigue paso a paso.

### 3.1 Acceder a Visual Mapper

```
1. Login (si no lo hiciste)
2. Sidebar izquierdo → Click en "Visual Mapper"
3. Ves formulario con campo "URL"
```

### 3.2 Ingresar URL

**Paso 1**: En el campo "URL", ingresa dirección del sitio

```
Ejemplos válidos:
- https://www.amazon.com/s?k=laptop
- https://www.mercadolibre.com.ar/...
- https://www.carrefour.com.ar/...
- https://www.jumbo.com.ar/...
```

**Validaciones**:
- ✅ Debe empezar con `http://` o `https://`
- ✅ Debe ser URL válida
- ❌ No URLs incompletas: `www.amazon.com` (falta protocolo)

**Paso 2**: Click en **"Open Extension Mapper"**

Esperado:
```
- Se abre pestaña nueva
- Extensión inyecta en el sitio
- Ves mensaje: "Extension tab is open"
- Lado izquierdo: "Click the card that wraps one product"
```

### 3.3 Mapear Campos Visualmente

**En la pestaña de la extensión** (sitio target):

```
PASO 1: Seleccionar Contenedor
├─ Busca un PRODUCTO en la página
├─ Click en la CAJA/CARD que lo rodea
│  (Ej: en Amazon, click en el rectángulo del producto)
└─ Se resalta con borde azul

PASO 2: Sistema Detecta Automáticamente
├─ Identifica: precio, título, imagen
├─ Muestra campos en panel izquierdo
└─ Previsualiza productos extraídos

PASO 3: Ajustar Campos (si necesita)
├─ Click en campo que falta o es incorrecto
├─ Selecciona elemento en la página
└─ Sistema actualiza mapping

PASO 4: Finalizar
├─ Click en botón "Finish - Extract All"
└─ Vuelve a Angular (panel principal)
```

**Pantalla esperada en extensión**:
```
┌──────────────────────────────────────┐
│ 🔍 Mapped Fields          [Help]     │
├──────────────────────────────────────┤
│ ✓ Title:     .product-title          │
│ ✓ Price:     .product-price          │
│ ✓ Image:     img.product-image       │
│ ✓ Container: .product-card           │
│                                      │
│ Products Found: 24                   │
│                                      │
│ [Finish - Extract All]               │
└──────────────────────────────────────┘
```

### 3.4 Validar y Guardar Regla

**Vueltas a Angular**, en panel "Visual Mapper":

```
PASO 1: Ver Previsualización
├─ Tabla con productos extraídos
├─ Columns: Título, Precio, Imagen
└─ Puedes scroll para verificar todos

PASO 2: Seleccionar Categoría (opcional)
├─ Dropdown: "Selecciona categoría"
├─ Opciones: Ropa, Electrónica, Supermercados, etc
└─ Importante para organizar

PASO 3: Guardar Regla
├─ Click en botón azul "Save Rule"
├─ Sistema guarda el mapeo
├─ Mensaje: "✅ Rule saved successfully"
└─ Regla reutilizable para ese dominio
```

**¿Qué es una Regla?**

Una regla es un "template" que guarda:
- El sitio (dominio)
- Los campos mapeados (title, price, image)
- El contenedor (selector CSS)

Cuando ejecutes "Scrape Now", usa esta regla.

---

### 3.5 Extraer Productos (Scrape Now)

**Después de guardar la regla**:

```
PASO 1: Click en "Scrape Now"
├─ Abre pestaña nueva con el sitio
├─ Extensión aplica la regla guardada
└─ Extrae productos automáticamente

PASO 2: Ver Resultados en Tabla
├─ Vuelve a Angular
├─ Tabla editable con productos
├─ Puedes corregir datos manualmente

PASO 3: Editar Inline (si necesita)
├─ Click en celda para editar
├─ Cambiar título, precio, etc
└─ Presiona Enter para guardar

PASO 4: Guardar en Base de Datos
├─ Click en botón "Save Products"
├─ Mensaje: "✅ Products ingested: 24"
└─ Guardado en DB, accesible en "Products" page
```

**Tabla editable**:
```
┌──────────────────────────────────────┐
│ Title            │ Price  │ Image   │
├──────────────────────────────────────┤
│ Laptop Dell      │ $999   │ [img]   │  ← Click para editar
│ Monitor LG 24"   │ $299   │ [img]   │
│ Mouse Logitech   │ $49    │ [img]   │
└──────────────────────────────────────┘
```

---

### 3.6 Programar Auto-Replay (Opcional)

**Después de guardar productos**:

```
PASO 1: Click en "Enable Schedule"
├─ Checkbox se activa
└─ Aparece campo de intervalo

PASO 2: Ingresar Intervalo
├─ Campo: "Intervalo (horas)"
├─ Ejemplo: 4 (cada 4 horas)
└─ Mínimo: 1 hora

PASO 3: Guardar Schedule
├─ Click en botón "Save Schedule"
├─ Mensaje: "✅ Schedule saved"
└─ Cada 4 horas ejecuta automáticamente

PASO 4: Verificar (opcional)
├─ En "Domains" page
├─ Ves la regla con schedule activo
├─ Columna "Last Scraped": muestra última ejecución
└─ Auto se actualiza cada intervalo
```

**Cómo funciona**:
- Extensión tiene background scheduler (chrome.alarms)
- Cada intervalo, ejecuta scrape automático
- Guarda productos en DB
- No necesitas estar en la app

**Para desactivar**:
```
1. Visual Mapper → Misma regla
2. Desactiva "Enable Schedule"
3. Click "Save Schedule"
```

---

## 📦 Gestión de Productos

### 4.1 Acceder a Productos

```
Sidebar → Click en "Products"
```

**Pantalla**:
```
┌─────────────────────────────────────┐
│ 🔍 Search [...........] 📊 Filter   │
├─────────────────────────────────────┤
│ Title            │ Price │ Source   │
├─────────────────────────────────────┤
│ Laptop Dell      │ $999  │ Amazon   │
│ Monitor LG       │ $299  │ Mercado  │
│ Mouse Logitech   │ $49   │ Carrefour│
│                                     │
│ < 1 2 3 4 > (Paginación)           │
│                                     │
│ 📈 Price Chart (gráfico)           │
└─────────────────────────────────────┘
```

### 4.2 Búsqueda y Filtros

**Buscar por título**:
```
1. Click en campo "Search"
2. Ingresa palabra clave: "laptop", "precio", etc
3. Presiona Enter
4. Filtra productos en tiempo real
```

**Filtrar por dominio**:
```
1. Click en "Filter"
2. Selecciona dominio (Amazon, Mercado Libre, etc)
3. Ves solo productos de ese origen
```

### 4.3 Editar Productos

**Edición inline**:
```
1. Click en celda (precio, título, etc)
2. Campo se vuelve editable
3. Modifica valor
4. Presiona Enter para guardar
5. Ícono ✓ confirma guardado
```

### 4.4 Ver Historial de Precios

**Gráfico de tendencia**:
```
1. Ves gráfico ApexCharts al pie
2. Eje Y: precio
3. Eje X: fecha
4. Línea por producto
5. Hoverea para ver valores exactos
```

**Análisis**:
- Detecta cambios de precio
- Muestra tendencias (subida, bajada)
- Identifica picos anormales

### 4.5 Eliminar Productos

**Individual**:
```
1. Hover en fila
2. Click en ícono 🗑️ (papelera)
3. Confirmar eliminación
```

**Múltiple**:
```
1. Checkbox al inicio de cada fila
2. Selecciona varios productos
3. Click en botón "Delete Selected"
4. Confirmar
```

### 4.6 Exportar a CSV

```
1. Click en botón "Export CSV"
2. Se descarga archivo: products-YYYYMMDD.csv
3. Abre en Excel/Google Sheets
```

**Contenido CSV**:
```
title,price,source,domain,extractedAt
Laptop Dell,$999,Amazon,amazon.com,2026-07-21
Monitor LG,$299,Mercado Libre,mercadolibre.com,2026-07-21
```

---

## 🔌 Gestión de Dominios

### 5.1 Acceder a Dominios

```
Sidebar → Click en "Domains"
```

**Lista de reglas**:
```
┌──────────────────────────────────────────┐
│ Domain          │ Status    │ Actions   │
├──────────────────────────────────────────┤
│ amazon.com      │ Active ✓  │ ✏️ 🗑️    │
│ mercadolibre    │ Active ✓  │ ✏️ 🗑️    │
│ carrefour.com   │ Inactive  │ ✏️ 🗑️    │
└──────────────────────────────────────────┘
```

### 5.2 Ver Detalles de Regla

```
1. Click en nombre dominio
2. Ves:
   - URL de la regla
   - Campos mapeados (title, price, image)
   - Contenedor selector
   - Fecha última ejecución
   - Estado del schedule
```

### 5.3 Editar Regla

```
1. Click en ícono ✏️ (lápiz)
2. Puedes cambiar:
   - Campos mapeados
   - Contenedor selector
   - Categoría asignada
3. Click "Save Changes"
4. Sistema valida cambios
```

### 5.4 Eliminar Regla

```
1. Click en ícono 🗑️ (papelera)
2. Confirmar eliminación
3. Se elimina regla pero NO los productos guardados
4. Productos quedan en "Products" page
```

### 5.5 Ver Productos de una Regla

```
1. Dominio page → ícono "👁️ View Products"
2. Filtra solo productos de ese dominio
3. Puedes editar/eliminar desde ahí
```

---

## 🏷️ Gestión de Categorías

### 6.1 Acceder a Categorías

```
Sidebar → Click en "Categories"
```

**Categorías predefinidas**:
```
- Ropa
- Electrónica
- Supermercados
- Hogar
- Deportes
- Juguetes
- Belleza
- Mascotas
- Libros
```

### 6.2 Ver Categoría

```
1. Click en nombre categoría
2. Ves:
   - Descripción
   - Productos en esta categoría
   - Campos por defecto
```

### 6.3 Crear Nueva Categoría

```
1. Click en botón "+ Add Category"
2. Formulario:
   - Name: "Electródomésticos"
   - Description: "Heladeras, hornos, etc"
   - Default Fields: [title, price, image]
3. Click "Create"
4. Se agrega a lista
```

### 6.4 Editar Categoría

```
1. Click en ícono ✏️
2. Edita nombre, descripción, campos
3. Click "Save Changes"
```

### 6.5 Eliminar Categoría

```
1. Click en ícono 🗑️
2. Confirmar
3. Productos en esta categoría NO se eliminan
4. Solo se desvincula la categoría
```

---

## 📊 Dashboard y Analytics

### 7.1 Acceder a Dashboard

```
Sidebar → Click en "Dashboard"
```

**Acceso público**: El dashboard NO requiere login (URL: `/dashboard`)

### 7.2 Visión General (KPIs)

```
Ves 5 tarjetas principales:

┌──────────────────────────────────┐
│ 📊 Precio Promedio por Categoría │
│ - Electrónica: $1,299            │
│ - Ropa: $89                      │
│ - Supermercados: $45             │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ 🌍 Distribución por Fuente       │
│ Amazon: 45% | Mercado: 35%       │
│ Carrefour: 20%                   │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ ⚠️ Outliers (Precios Anormales) │
│ Laptop (Electrónica): $15,000    │
│ Heladera (Hogar): $8,000         │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ 📈 Percentiles de Precio         │
│ p25: $50  | p50: $300            │
│ p75: $1000| p90: $2500           │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ 📅 Serie Temporal (por trimestre)│
│ Q1 2026: $450 promedio           │
│ Q2 2026: $475 promedio           │
└──────────────────────────────────┘
```

### 7.3 Gráficos Interactivos

**ApexCharts** (gráficos):
- Hover: ve valores exactos
- Zoom: doble click en área
- Exportar: ícono en esquina superior derecha
- Reset: doble click nuevamente

### 7.4 Resumen de Base de Datos

```
Tabla: "Database Summary"
┌─────────────────────────┐
│ Tabla        │ Conteos  │
├─────────────────────────┤
│ Products     │ 2,456    │
│ Offers       │ 5,234    │
│ Price Obs.   │ 12,567   │
│ Domains      │ 8        │
│ Categories   │ 9        │
└─────────────────────────┘
```

### 7.5 Análisis Avanzados

**Consultas especiales**:
- Pregunta Principal: Comportamiento de precios por fuente × categoría
- Productos Rankeados: Más económico + más caro por fuente
- Distribución Categórica: Heatmap de fuente × categoría
- Detección de Outliers: Por rango intercuartílico (IQR)
- Encuesta de Consumo: Género × sitio preferido

---

## ⏱️ Auto-Replay (Programación)

### 8.1 Cómo Funciona

```
Arquitectura:
┌─────────────┐
│  Angular    │ "Set Schedule: 4 horas"
├─────────────┤
│  Extension  │ Chrome.alarms: "ejecuta cada 4h"
├─────────────┤
│  Backend    │ Recibe request autenticado
├─────────────┤
│  DB         │ Guarda productos extraídos
└─────────────┘
```

**Requisitos**:
- ✅ Extensión instalada
- ✅ Dominio guardado (regla)
- ✅ Schedule habilitado
- ✅ JWT token válido (Angular lo pasa automáticamente)

### 8.2 Programar Schedule

**En Visual Mapper**:
```
1. Después de "Save Products"
2. Sección "Schedule Configuration" aparece
3. Checkbox: "Enable Schedule"
4. Input: "Intervalo (horas)" → 4
5. Click: "Save Schedule"
6. Mensaje: "✅ Schedule saved for amazon.com"
```

### 8.3 Monitorear Ejecuciones

**En Domains page**:
```
Ves columna: "Last Scraped"
├─ amazon.com: "2026-07-21 14:30" ✓
├─ mercadolibre: "2026-07-21 10:15" ✓
└─ carrefour: "2026-07-20 18:45" (hace >24h, revisar)
```

**En Products page**:
```
Columna "Extracted At" muestra cuándo se extrajeron
├─ Productos de hoy = auto-replay funcionando ✓
└─ Productos viejos = revisar schedule
```

### 8.4 Detener Schedule

**Para desactivar**:
```
1. Visual Mapper
2. Misma regla
3. Desactiva "Enable Schedule"
4. Click "Save Schedule"
5. Extension deja de ejecutar
```

### 8.5 Troubleshooting Schedule

**¿No ejecuta automáticamente?**

```
Checklist:
1. ✅ Extensión instalada (ícono verde)
2. ✅ Chrome está abierto (background scripts necesitan eso)
3. ✅ Schedule está habilitado (checkbox marcado)
4. ✅ JWT válido (reloguéate)
5. ✅ Intervalo >= 1 hora

Si falla:
→ Abre DevTools (F12) → Extension
→ Ve a "chrome://extensions/details/..."
→ Inspecciona background service worker
→ Busca errores en console
```

---

## 💡 Casos de Uso

### 9.1 Monitorear Precios de Competencia

**Objetivo**: Detectar cambios de precio en competidores

```
PASO 1: Mapear Competidores
├─ Visual Mapper → URL competidor 1
├─ Mapear: título, precio, imagen
├─ Save Rule
└─ Repetir para competidor 2, 3, ...

PASO 2: Programar Auto-Replay
├─ Schedule: cada 24 horas
├─ Extrae automáticamente
└─ Historial siempre actualizado

PASO 3: Analizar en Dashboard
├─ Ve gráfico de precios
├─ Identifica cambios
├─ Exporta a CSV para análisis
└─ Toma decisiones de precios
```

**Resultado**:
- Sabes cuándo bajan/suben precios
- Compites con información actualizada
- Automatización total (sin mantenimiento)

---

### 9.2 Extraer Catálogo Inicial

**Objetivo**: Cargar 1000+ productos en la base de datos

```
PASO 1: Preparar Sitio
├─ URL principal (ej: lista de productos)
├─ Asegúrate que carga todos
└─ (Si es paginado, lleva múltiples extracciones)

PASO 2: Mapear Visualmente
├─ Open Extension
├─ Click en 1 producto
├─ Sistema detecta contenedor
└─ Finish

PASO 3: Extraer Todo
├─ Scrape Now
├─ Ves tabla con 1000+ productos
├─ Verifica unos pocos (spot check)
└─ Save Products

PASO 4: Exportar
├─ Products page
├─ Click "Export CSV"
├─ Descarga todas los productos
└─ Importa a tu sistema externo
```

**Tiempo**: 10-15 minutos vs. horas manuales

---

### 9.3 Comparar Precios Multi-Fuente

**Objetivo**: ¿Dónde es más barato el producto X?**

```
PASO 1: Extraer del Producto en 3+ Sitios
├─ Amazon: laptop = $1,299
├─ Mercado Libre: laptop = $1,199
├─ Carrefour: laptop = $1,399

PASO 2: Ver en Dashboard
├─ Gráfico: "Precio por Fuente"
├─ Ves Mercado Libre es más barato
└─ Series temporales: tendencias

PASO 3: Tomar Decisión
├─ Compra en Mercado Libre
├─ O ofrece mejor precio
└─ Queda guardado en historial para futuro
```

---

### 9.4 Detectar Outliers (Precios Raros)

**Objetivo**: Encontrar productos con precio anormalmente alto/bajo

```
PASO 1: Dashboard → "Outliers"
├─ Ves productos con IQR extremo
├─ Ejemplo: Monitor a $50 (debería ser $300)
└─ Ícono ⚠️ marca anomalía

PASO 2: Investigar
├─ Click en outlier
├─ Ve a Products page
├─ Busca ese producto
├─ Verifica si es error o oferta real

PASO 3: Acción
├─ Si es error: edita precio manualmente
├─ Si es oferta: stock limitado, compra rápido
└─ Analytics se actualiza automáticamente
```

---

## 🛠️ Troubleshooting

### 10.1 "Extension not available" (ícono rojo)

**Problema**: Extensión no está instalada o no funciona

**Soluciones**:

```
1. Verificar que está instalada
   ├─ Chrome: chrome://extensions
   ├─ Firefox: about:addons
   ├─ Edge: edge://extensions
   └─ Ver que dice "enabled" o "active"

2. Si no está: descargar e instalar
   ├─ Settings → Extension Setup
   ├─ Descarga ZIP para tu navegador
   ├─ Descomprimir
   └─ Cargar en navegador (ver sección 2)

3. Si está pero dice "not available"
   ├─ Recarga página (Ctrl+R)
   ├─ Cierra todas las pestañas de la app
   ├─ Abre nuevamente
   └─ Espera 5 segundos para handshake
```

---

### 10.2 "Extension no se abre" al clickear "Open Extension Mapper"

**Problema**: Click en botón pero no pasa nada

**Causas y soluciones**:

```
1. Extensión detecta error
   → Abre DevTools (F12)
   → Va a Console
   → Busca mensajes de error rojo
   → Screenshot y reporta

2. URL no válida
   → Verifica URL comience con http:// o https://
   → No espacios en blanco
   → Dominio debe existir

3. Sitio bloquea scraping
   → Algunos sitios tienen protecciones
   → Intenta con otra URL del mismo dominio
   → (Amazon, Mercado Libre generalmente permiten)

4. Reinicia extensión
   → chrome://extensions → Desactiva y reactiva
   → O recarga página (Ctrl+R)
```

---

### 10.3 "Productos no se extraen correctamente"

**Problema**: Faltan campos o datos vacíos

**Soluciones**:

```
1. Re-mapear manualmente
   ├─ Open Extension Mapper nuevamente
   ├─ Click en campo que falta
   ├─ Selecciona elemento en página
   ├─ Espera que sistema lo detecte
   └─ Finish nuevamente

2. CSS Selector cambió
   ├─ Sitio actualizó estructura HTML
   ├─ Producto ahora tiene clase diferente
   ├─ Solución: volver a mapear
   └─ Eliminar regla vieja, crear nueva

3. Sitio bloqueó scraping
   ├─ Algunos sitios detectan bots
   ├─ Intenta en incógnito
   ├─ O con VPN diferente
   └─ Última opción: scrape manual
```

---

### 10.4 "Login no funciona"

**Problema**: Email/contraseña no aceptados

**Soluciones**:

```
1. Verificar credenciales
   ├─ Email: admin@example.com (sin espacios)
   ├─ Password: adminpassword (exacto)
   ├─ Sensible a mayúsculas
   └─ Reintenta

2. Backend no está corriendo
   ├─ Verifica: http://localhost:3000/api
   ├─ Si no carga → backend está down
   ├─ Terminal backend: Ctrl+C y reinicia
   ├─ `pnpm dev` (o `docker-compose up -d`)
   └─ Espera 30 segundos

3. Base de datos no tiene datos
   ├─ Ejecutaste seed.ts? (ver DEPLOYMENT_GUIDE.md)
   ├─ Si no: npm run seed (o npx tsx prisma/seed.ts)
   └─ Reintenta login

4. Caché del navegador
   ├─ DevTools → Network
   ├─ Desactiva caché
   ├─ Recarga (Ctrl+Shift+R hard refresh)
   └─ Reintenta
```

---

### 10.5 "Database error" o "No connection"

**Problema**: Backend no puede conectar a PostgreSQL

**Soluciones**:

```
1. Verificar que PostgreSQL corre
   ├─ docker ps | grep postgres
   ├─ Debe mostrar 2 containers (5433, 5434)
   ├─ Si no está: docker-compose up -d postgres
   └─ Esperar 30 segundos a que esté healthy

2. Variables de conexión
   ├─ Verificar .env
   ├─ DATABASE_URL debe tener credenciales correctas
   ├─ ANALYTICS_DATABASE_URL para DW
   └─ Reiniciar backend

3. Puerto bloqueado
   ├─ Algo usa puerto 5433 o 5434
   ├─ lsof -i :5433
   ├─ Matar proceso: kill -9 <PID>
   ├─ O cambiar puerto en docker-compose.yml

4. Reiniciar todo
   ├─ docker-compose down
   ├─ docker-compose up -d
   ├─ Esperar health checks
   └─ Reintenta operación
```

---

### 10.6 "No puedo mapear campos en la extensión"

**Problema**: Click en elemento pero no se detecta

**Causas**:

```
1. Estructura del sitio muy compleja
   ├─ Sitio usa JavaScript para renderizar
   ├─ O HTML dinámico que cambia constantemente
   ├─ Solución: Intenta con URL más simple
   └─ O mismo sitio pero categoría diferente

2. Elemento dentro de iframe
   ├─ Algunos sitios usan iframes
   ├─ Content script no puede entrar a iframes
   ├─ Solución: mapear elemento fuera del iframe
   └─ O usar sitio alternativo

3. Elemento tiene JavaScript listeners
   ├─ Click abre modal o navega
   ├─ Solución: espera unos segundos antes de click
   ├─ O intenta click derecho → "Inspect element"
   └─ Copiar selector CSS manualmente (avanzado)
```

---

### 10.7 "Auto-replay no ejecuta"

**Problema**: Programé schedule pero no extrae cada N horas

**Verificaciones**:

```
1. ¿Extensión está instalada?
   ├─ Ícono en app debe ser verde ✓
   └─ Si no: instalar (ver sección 2)

2. ¿Chrome/navegador está abierto?
   ├─ Background scripts necesitan navegador corriendo
   ├─ Cierra y abre Chrome
   ├─ Mantén abierto en background
   └─ O usa "Keep Chrome running in background"

3. ¿Schedule está habilitado?
   ├─ Visual Mapper → misma regla
   ├─ Checkbox "Enable Schedule" debe estar ✓
   ├─ Intervalo debe ser >= 1
   └─ Botón "Save Schedule" debe mostrarse

4. ¿JWT token es válido?
   ├─ Reloguéate en la app
   ├─ Token se pasa automáticamente
   └─ Sin token válido, falla auth

5. Revisar chrome.alarms (debugging)
   ├─ DevTools → Sources → Extension
   ├─ Busca chrome.alarms listeners
   ├─ Verificar que timer está activo
   └─ Revisar console para errores
```

---

## 📞 Soporte

Si ninguna solución funciona:

1. **Revisa Console** (DevTools → F12 → Console)
   - Busca errores rojos
   - Screenshot si hay error específico

2. **Revisa Logs Backend**
   - `docker logs scraper-backend`
   - Busca línea roja de error

3. **Reinicia Todo**
   - `docker-compose down`
   - `docker-compose up -d`
   - Espera 60 segundos
   - Reintenta operación

4. **Contacta Desarrollador**
   - Incluir: screenshot, pasos para reproducir, logs

---

## 🎉 ¡Listo para Usar!

Ahora tienes:
- ✅ App instalada y corriendo
- ✅ Extensión en tu navegador
- ✅ Guía completa de uso
- ✅ Soluciones para problemas comunes

**Siguiente paso**: Accede a http://localhost:8080 y comienza a mapear tu primer sitio. 🚀

---

**Última actualización**: 2026-07-21  
**Versión**: 1.0  
**Navegadores soportados**: Chrome, Firefox, Edge, Safari
