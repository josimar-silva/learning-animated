---
id: two-datasources
section: data
order: 8
title: One endpoint, two datasources
description: checkout() reads the held seats from the inventory datasource and the buyer from the accounts datasource, each through its own pool. Writing to both in one transaction needs XA.
objective: See that each named datasource has its own pool and its own @DataSource qualifier, and why writing to two datasources in one transaction needs XA.
references:
  - label: 'Quarkus datasources: configure multiple datasources'
    url: https://quarkus.io/guides/datasource/#configure-multiple-datasources
  - label: 'Quarkus datasources: named datasource injection'
    url: https://quarkus.io/guides/datasource/#named-datasource-injection
  - label: 'Quarkus datasources: multiple datasources in a single transaction'
    url: https://quarkus.io/guides/datasource/#datasource-multiple-single-transaction
steps:
  - at: 0
    text: 'checkout() injects two named datasources, inventory and accounts. Quarkus starts a separate pool for each one.'
  - at: 3
    text: 'It reads the held seats through @DataSource("inventory"), on a connection from the inventory pool.'
  - at: 6.5
    text: 'It reads the buyer through @DataSource("accounts"), on a connection from the accounts pool. No transaction is open.'
  - at: 10
    text: 'confirm() is @Transactional and writes to both. The inventory connection joins and marks A12 and A13 sold.'
  - at: 13.5
    text: 'The accounts connection fails to enlist: without XA, a transaction holds one datasource. The seat update rolls back.'
  - at: 17
    text: 'With jdbc.transactions=xa on both datasources, both connections join the same transaction.'
  - at: 21
    text: 'The commit has two phases: both databases prepare, then both commit, so the seats and the purchase are saved together.'
---

A named datasource carries its name in every configuration key: `quarkus.datasource.inventory.db-kind` and `quarkus.datasource.accounts.db-kind` declare two datasources, and any other key, such as `jdbc.max-size`, can differ between them. Quarkus only detects a named datasource that sets at least one build-time property, usually `db-kind`. At startup it creates a JDBC connection pool for each active datasource.

`checkout()` picks a datasource with the `@DataSource` qualifier, as in `@Inject @DataSource("inventory") AgroalDataSource inventory`. The seats query borrows a connection from the inventory pool, and the buyer query borrows one from the accounts pool. Neither read runs in a transaction, so each connection goes back to its own pool as soon as its query is done.

Without XA, a transaction can hold only one datasource, reads included. When `confirm()` takes an accounts connection, Agroal fails to enlist it, and the transaction rolls back the seat update. Setting `jdbc.transactions=xa` on both datasources lets both connections join, and the transaction manager commits them in two phases. That property is fixed at build time, and each database server must have XA enabled. If one database cannot do XA, Quarkus still accepts exactly one non-XA datasource next to XA ones (Last Resource Commit Optimization). If the two writes do not need to roll back together, give each its own transaction with `@Transactional(REQUIRES_NEW)`.
