-- Increase titulo_oferta limit from 500 to 700 chars
ALTER TABLE dw.dim_producto ALTER COLUMN titulo_oferta TYPE varchar(700);
