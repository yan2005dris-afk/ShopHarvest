# `--smoke-run` — Puerta de CI para validar el shell de la app

## Qué es

Un flag de `backend/src/main.ts` que arranca NestJS, resuelve todo el grafo de DI (incluyendo `OnModuleInit` y `OnApplicationBootstrap`) y sale con código `0` **sin abrir un puerto real** ni disparar el cron de ETL.

## Cómo se usa

```bash
pnpm --filter backend build
node backend/dist/main.js --smoke-run
echo $?   # 0 si todo cableó, ≠ 0 si algo explotó
```

Salida esperada (una sola línea):

```
[Nest] LOG [Bootstrap] Nest application successfully bootstrapped (smoke-run)
```

## Por qué existe

Validar "la app anda" en CI tenía dos opciones hasta ahora:

| Opción                                              | Costo   | Qué cubre                                                  |
| --------------------------------------------------- | ------- | ---------------------------------------------------------- |
| Unit tests                                         | medio   | Lógica puntual, no garantizan el grafo de DI completo      |
| Levantar la app de verdad (`app.listen`)            | alto    | ~30s + Postgres + Redis + puerto libre                     |
| **`--smoke-run`**                                  | **< 10s** | **Grafo de DI + lifecycle hooks, sin red ni DB**         |

Los unit tests cubren lógica pero **no garantizan** que providers, factories y módulos se conecten bien. Levantar la app de verdad es lento y necesita servicios externos. Este flag da una respuesta barata a la pregunta real: *"¿los módulos bootean sin explotar?"*.

## Qué bugs atrapa

- Provider nuevo sin registrar en un módulo
- Dependencia circular entre módulos
- Factory que tira en construcción
- `OnModuleInit` con un service mal inyectado
- `ConfigModule` leyendo una env var requerida que no existe
- `OnApplicationBootstrap` con副作用 que falla al bootear

## Qué NO atrapa

Esto es importante entender los límites:

- ❌ HTTP routing real (no hay `app.listen`, no se ejecutan controllers)
- ❌ Queries a la DB (asume que las env vars están pero no las ejecuta)
- ❌ Guards, interceptors, pipes aplicados a endpoints específicos
- ❌ Lógica de negocio dentro de services

Es un **smoke test del shell de la aplicación**, no de la lógica. Complementa a `unit` + `e2e`, no los reemplaza.

## Detalle de implementación

El flag vive en `backend/src/main.ts`:

```ts
const SMOKE_RUN = process.argv.includes('--smoke-run');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ... setGlobalPrefix, enableCors, useGlobalPipes, swagger ...

  if (SMOKE_RUN) {
    await app.init();   // ← resuelve DI + lifecycle hooks, NO listen
    new Logger('Bootstrap').log(
      'Nest application successfully bootstrapped (smoke-run)',
    );
    await app.close();
    process.exit(0);
  }

  await app.listen(port);
}
```

**Por qué logueamos nuestra propia línea:** NestJS 11 ya **no imprime** el clásico `"Nest application successfully bootstrapped"` que versiones viejas sí emitían. Sin esta línea custom, en CI solo verías el `exit 0` sin saber si el bootstrap realmente ocurrió o si el proceso salió por otra razón.

**Por qué no se dispara el cron:** los schedulers de NestJS (`@nestjs/schedule`) registran los jobs en `OnApplicationBootstrap`. Nuestro `app.close()` los des-registra antes de que el primer tick se dispare, porque `close()` apaga el scheduler limpio.

## Uso en CI

En `.github/workflows/ci.yml` (o equivalente) el paso es:

```yaml
- name: Build + boot smoke
  run: |
    pnpm install --frozen-lockfile
    pnpm --filter backend build
    node backend/dist/main.js --smoke-run
```

Si este paso rompe, **no tiene sentido correr `pnpm test`** — el problema es de cableado y los tests van a fallar en cascada por eso.

## Uso local

```bash
cd backend
pnpm build
node dist/main.js --smoke-run
```

Útil cuando:

- Agregás un módulo nuevo y querés validar que todo cablea antes de levantar Postgres
- Cambiás un `OnModuleInit` y querés ver si rompe el bootstrap
- Estás debugueando "¿esto está fallando por DI o por lógica?"
