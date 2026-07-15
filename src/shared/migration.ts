/** Row counts per table actually imported — what the admin uses to sanity
 *  check the import against their old install. */
export type MigrationRowCounts = Record<string, number>

/** Row counts per table already present in the destination — surfaced when
 *  the import is refused because the destination isn't empty. */
export type DestinationTableCounts = Record<string, number>
