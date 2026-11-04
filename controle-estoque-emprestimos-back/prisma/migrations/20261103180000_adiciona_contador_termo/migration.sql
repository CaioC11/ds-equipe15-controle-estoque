CREATE TABLE "ContadorTermo" (
    "ano" INTEGER NOT NULL,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContadorTermo_pkey" PRIMARY KEY ("ano")
);

INSERT INTO "ContadorTermo" ("ano", "ultimoNumero")
SELECT
    split_part("numeroAno", '/', 2)::INTEGER,
    MAX(split_part("numeroAno", '/', 1)::INTEGER)
FROM "Termo"
WHERE "numeroAno" ~ '^[0-9]+/[0-9]{4}$'
GROUP BY split_part("numeroAno", '/', 2);
