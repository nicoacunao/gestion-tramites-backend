# Homologación matriz operativa y catálogo N1/N2/N3

Fuente funcional: `Downloads/Mariz operativa (1).xlsx`, hoja `60001`.

Esta homologación usa la matriz como referencia funcional y separa las
correcciones confirmadas de los casos que requieren decisión antes de generar
una migración de datos.

## N1

| Matriz                                                          | `tipo_gestion.id_tipo_gestion`       | Estado   |
| --------------------------------------------------------------- | ------------------------------------ | -------- |
| PATENTE COMERCIAL                                               | `patente-comercial`                  | Coincide |
| RESOLUCION SANITARIA ALIMENTOS                                  | `resolucion-sanitaria-alimentos`     | Coincide |
| INFORME SANITARIO ESTABLECIMIENTOS INDUSTRIALES Y/O COMERCIALES | `informe-sanitario-establecimientos` | Coincide |
| REGULARIZACION OBRAS                                            | `regularizacion-obras`               | Coincide |

## N2 incluidos en la matriz

| N1                      | N2 de la matriz                                       | ID existente | Código existente                  | Estado            |
| ----------------------- | ----------------------------------------------------- | -----------: | --------------------------------- | ----------------- |
| Patente comercial       | Informe de obras para patente comercial               |            1 | `informe-obras-patente-comercial` | Coincide          |
| Patente comercial       | Solicitud de patente EDS                              |            2 | `solicitud-patente-eds`           | Coincide          |
| Patente comercial       | Documentación extraordinaria                          |            3 | `documentacion-extraordinaria`    | Coincide          |
| Patente comercial       | Solicitud de patente PRONTO                           |            4 | `solicitud-patente-pronto`        | Coincide          |
| Patente comercial       | Traspaso de patente provisoria a definitiva           |            5 | `traspaso-patente-definitiva`     | Coincide          |
| Resolución sanitaria    | Local de elaboración de alimentos con consumo al paso |            7 | `local-elaboracion-consumo-paso`  | Homologar nombre  |
| Resolución sanitaria    | Local de expendio de alimentos con consumo al paso    |            8 | `local-expendio-consumo-paso`     | Homologar nombre  |
| Resolución sanitaria    | Local de expendio de alimentos                        |            9 | `local-expendio-alimentos`        | Homologar nombre  |
| Regularización de obras | Permiso de obra menor DOM                             |           12 | `permiso-obra-menor-dom`          | Homologar formato |
| Regularización de obras | Recepción de permiso de obra menor                    |           13 | `recepcion-permiso-obra-menor`    | Homologar formato |

## Gestiones específicas existentes fuera de la matriz explícita

Estas gestiones existen en el catálogo, pero no tienen una fila N2 explícita en
la hoja revisada y no deben modificarse automáticamente:

|  ID | Gestión específica                   | Motivo                                   |
| --: | ------------------------------------ | ---------------------------------------- |
|   6 | Elaboración                          | No aparece como N2 explícito en la hoja  |
|  10 | Carros                               | No aparece como N2 explícito en la hoja  |
|  11 | Informe sanitario de establecimiento | La matriz muestra N3 directos bajo el N1 |

## Regla de catálogo N2

Para los 10 N2 incluidos en la matriz se debe crear o reutilizar un antecedente
real del catálogo con:

```text
antecedente.nombre = nombre canónico del N2
antecedente.categoria = 'requerido'
gestion_especifica_antecedente.nivel = 'N2'
gestion_especifica_antecedente.id_antecedente_padre = NULL
```

Los N3 de cada N2 deben conservar `nivel = 'N3'` y apuntar al antecedente N2
mediante `id_antecedente_padre`.

No se debe utilizar la igualdad numérica entre `id_gestion_especifica` e
`id_antecedente` para inferir niveles.

## Diferencias detectadas en N3

### Confirmadas para corregir

- N2 ID 1: los dos N3 existen, pero actualmente no tienen padre.
- N2 ID 4: los 11 N3 existen, pero actualmente no tienen padre.
- N2 ID 3: `Informe Bomberos` de la matriz corresponde probablemente a
  `Informe de Bomberos` del catálogo; requiere homologación de nombre.
- N2 ID 2: los N3 existen, pero hay diferencias de tildes, abreviaturas y
  redacción entre Excel y catálogo.

### Casos que requieren confirmación funcional

- N2 ID 2: la matriz contiene 14 N3 y el catálogo contiene 15. El catálogo
  adicional es `LG - Traspaso de patente`.
- N2 ID 7 y 8: la matriz no muestra N3 debajo de esos N2; el catálogo actual
  sí tiene relaciones N3. No eliminar sin confirmación.
- N2 ID 9: la matriz y el catálogo representan la misma estructura, pero hay
  diferencias ortográficas menores.
- N1 `Informe sanitario de establecimientos`: la matriz muestra antecedentes
  N3 directos sin N2 intermedio. Se debe conservar esa estructura salvo que la
  matriz original tenga filas ocultas o incompletas.

## Correcciones no aplicadas aún

Este documento no modifica la base de datos. Antes de ejecutar una migración se
debe aprobar:

1. El nombre canónico de los 10 antecedentes N2.
2. Si `LG - Traspaso de patente` pertenece o no al N2 ID 2.
3. Si los N3 de los N2 ID 7 y 8 deben existir aunque no estén visibles en la
   matriz.
4. Si los N3 del N1 de informe sanitario deben permanecer sin N2.

Una vez confirmados esos cuatro puntos, se puede generar una migración
determinística que cree los antecedentes N2 faltantes, corrija niveles y
reconstruya los padres de los N3 sin borrar información válida.
