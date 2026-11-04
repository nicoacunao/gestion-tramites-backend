# Persistencia

`TabularDataSource` es el límite técnico común para la etapa de esqueleto.

- `excel-graph/`: repositorio genérico y adaptador Graph deshabilitado.
- `sql/`: espacio de sustitución para una fuente SQL futura.

Los módulos definen sus propios puertos de repositorio. La composición futura
adaptará estos componentes genéricos a esos puertos; el dominio no importará
esta carpeta.
