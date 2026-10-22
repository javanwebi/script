# ATLAS2 source transfer

Source: javanwebi/asliatlas, published commit d593338eb52f7d3fa83445b6b9d0e1a78b5c9caf.

Application code, public catalog metadata, design and assets are copied from that snapshot. Legacy user/SMS databases and sample customer/order/financial records are excluded. Seed catalog prices, inventory and per-customer rates are cleared. Public business contact details and form examples remain part of the interface. Runtime accounts, secrets, database contents and deployment variables are not copied.

The import verifies TypeScript and the production build before pushing. Configure runtime settings and restore authorized business data through the administration panel when deploying this repository.
