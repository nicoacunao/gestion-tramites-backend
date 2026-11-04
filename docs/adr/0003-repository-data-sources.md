# ADR-0003: Repositorios independientes de la fuente

- Estado: aceptado para la arquitectura; estrategia Graph pendiente
- Fecha: 2026-11-03

## Decisión

Los módulos declaran interfaces de repositorio propias. La infraestructura
incluye un límite tabular y adaptadores intercambiables para Excel/Graph y SQL.
Ningún tipo de Microsoft Graph puede cruzar hacia aplicación o dominio.

## Motivo

Los datos viven hoy en Excel, pero se prevé migración SQL. Los casos de uso no
deben cambiar cuando se sustituya la persistencia.

## Restricción descubierta

Excel Workbook API no admite permisos de aplicación en las operaciones
verificadas. El adaptador se mantiene deshabilitado hasta aprobar OAuth delegado
o una estrategia alternativa basada en descargar/reemplazar el archivo.
