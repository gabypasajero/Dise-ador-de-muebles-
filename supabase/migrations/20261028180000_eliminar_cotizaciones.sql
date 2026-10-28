-- Eliminar cotizaciones: el vendedor borra las suyas que no estén vendidas; la administración, cualquiera.
create policy "vendedor elimina sus cotizaciones" on public.cotizaciones
  for delete to authenticated
  using (
    ((vendedor_id = (select auth.uid())) and (select es_vendedor()) and estado <> 'vendida')
    or (select es_admin())
  );

grant delete on public.cotizaciones to authenticated;
