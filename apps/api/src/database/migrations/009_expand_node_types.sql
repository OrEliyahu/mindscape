ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_type_check;

ALTER TABLE nodes ADD CONSTRAINT nodes_type_check CHECK (type IN (
  'sticky_note','text_block','image','drawing','code_block','shape','group','ai_response',
  'path','svg','gradient_shape','text_art'
));
