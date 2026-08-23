-- ═══════════════════════════════════════════════════════════════════
--  TOYOTA TALLER PERÚ — Datos de prueba
--  Ejecutar después de 01_schema.sql. Ver SPEC.md §8.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────── Categorías ────────────────────────────
insert into public.categorias (slug, nombre, descripcion, icono, orden) values
 ('filtros',     'Filtros',       'Aceite, aire, combustible y cabina',        'filter',  1),
 ('frenos',      'Frenos',        'Pastillas, discos, zapatas y líquidos',     'disc',    2),
 ('motor',       'Motor',         'Bujías, correas, bombas y refrigeración',   'engine',  3),
 ('suspension',  'Suspensión',    'Amortiguadores, rótulas y dirección',       'spring',  4),
 ('electrico',   'Sistema eléctrico','Baterías, alternadores e iluminación',   'bolt',    5),
 ('lubricantes', 'Lubricantes',   'Aceites, refrigerantes y aditivos',         'oil',     6),
 ('transmision', 'Transmisión',   'Embragues, aceites de caja y crucetas',     'gear',    7),
 ('accesorios',  'Accesorios',    'Plumillas, alfombras y protección',         'star',    8);

-- ─────────────────────── Modelos Toyota (Perú) ─────────────────────
insert into public.modelos_toyota (slug, nombre, carroceria, anio_desde, anio_hasta) values
 ('corolla',      'Corolla',      'sedán',     2000, null),
 ('yaris',        'Yaris',        'sedán',     2006, null),
 ('hilux',        'Hilux',        'pickup',    2005, null),
 ('rav4',         'RAV4',         'SUV',       2006, null),
 ('fortuner',     'Fortuner',     'SUV',       2006, null),
 ('prius',        'Prius',        'hatchback', 2010, null),
 ('camry',        'Camry',        'sedán',     2007, null),
 ('land-cruiser', 'Land Cruiser', 'SUV',       2000, null),
 ('rush',         'Rush',         'SUV',       2018, null),
 ('avanza',       'Avanza',       'minivan',   2010, null);

-- ────────────────────────── 24 repuestos ───────────────────────────
insert into public.repuestos
 (sku, slug, nombre, descripcion, categoria_id, numero_parte, marca_repuesto,
  precio, imagen_url, garantia_meses, especificaciones, destacado) values

 ('TOY-FIL-0001','filtro-aceite-90915-yzzd3',
  'Filtro de aceite Toyota Genuine 90915-YZZD3',
  'Filtro de aceite original con válvula antirretorno y medio filtrante de celulosa. Retiene partículas desde 20 micras y mantiene la presión del circuito en arranques en frío.',
  (select id from public.categorias where slug='filtros'), '90915-YZZD3',
  'Toyota Genuine Parts', 38.00, '/repuestos/filtro-aceite.jpg', 12,
  '{"rosca":"M20 x 1.5","altura_mm":85,"diametro_mm":68}', true),

 ('TOY-FIL-0002','filtro-aire-17801-0d060',
  'Filtro de aire de motor 17801-0D060',
  'Elemento filtrante plisado de alta superficie para el motor 1.8L. Protege la admisión del polvo urbano de Lima y sostiene el rendimiento del sensor MAF.',
  (select id from public.categorias where slug='filtros'), '17801-0D060',
  'Toyota Genuine Parts', 72.00, '/repuestos/filtro-aire.jpg', 12,
  '{"largo_mm":227,"ancho_mm":204,"alto_mm":40}', false),

 ('TOY-FIL-0003','filtro-combustible-23300-0l041',
  'Filtro de combustible diésel 23300-0L041',
  'Filtro de alta eficiencia para motores 2.4L y 2.8L diésel, con separador de agua. Crítico para proteger el sistema common-rail.',
  (select id from public.categorias where slug='filtros'), '23300-0L041',
  'Toyota Genuine Parts', 145.00, '/repuestos/filtro-combustible.jpg', 12,
  '{"eficiencia":"98% @ 5 micras","separador_agua":true}', false),

 ('TOY-FIL-0004','filtro-cabina-87139-0n010',
  'Filtro de aire de cabina (polen) 87139-0N010',
  'Filtro de carbón activado que retiene polvo, polen y olores del aire acondicionado. Recomendado cada 15 000 km.',
  (select id from public.categorias where slug='filtros'), '87139-0N010',
  'Toyota Genuine Parts', 58.00, '/repuestos/filtro-cabina.jpg', 6,
  '{"carbon_activado":true,"largo_mm":216,"ancho_mm":200}', false),

 ('TOY-FRE-0001','pastillas-freno-delanteras-04465-02220',
  'Pastillas de freno delanteras 04465-02220 (juego)',
  'Juego de 4 pastillas cerámicas de baja emisión de polvo, con indicador acústico de desgaste. Frenado estable en pendiente.',
  (select id from public.categorias where slug='frenos'), '04465-02220',
  'Toyota Genuine Parts', 210.00, '/repuestos/pastillas-delanteras.jpg', 12,
  '{"material":"cerámico","piezas":4,"espesor_mm":11}', true),

 ('TOY-FRE-0002','pastillas-freno-traseras-04466-42060',
  'Pastillas de freno traseras 04466-42060 (juego)',
  'Juego trasero con compuesto semimetálico y anclajes antivibración. Compatible con sistemas con freno de estacionamiento eléctrico.',
  (select id from public.categorias where slug='frenos'), '04466-42060',
  'Toyota Genuine Parts', 185.00, '/repuestos/pastillas-traseras.jpg', 12,
  '{"material":"semimetálico","piezas":4}', false),

 ('TOY-FRE-0003','discos-freno-delanteros-43512-02310',
  'Discos de freno delanteros 43512-02310 (par)',
  'Par de discos ventilados con tratamiento anticorrosivo. Disipan mejor el calor en tráfico intenso y reducen la vibración al frenar.',
  (select id from public.categorias where slug='frenos'), '43512-02310',
  'Toyota Genuine Parts', 480.00, '/repuestos/discos-freno.jpg', 12,
  '{"diametro_mm":275,"espesor_mm":25,"ventilado":true,"piezas":2}', false),

 ('TOY-FRE-0004','liquido-frenos-dot4',
  'Líquido de frenos Toyota DOT 4 (1 L)',
  'Fluido sintético con punto de ebullición seco de 260 °C. Reemplazo recomendado cada 2 años sin importar el kilometraje.',
  (select id from public.categorias where slug='frenos'), '08823-80011',
  'Toyota Genuine Parts', 45.00, '/repuestos/liquido-frenos.jpg', 24,
  '{"norma":"DOT 4","volumen_l":1}', false),

 ('TOY-FRE-0005','zapatas-freno-traseras-04495-52140',
  'Zapatas de freno traseras 04495-52140 (juego)',
  'Juego de zapatas para freno de tambor trasero, con resortes y pasadores incluidos.',
  (select id from public.categorias where slug='frenos'), '04495-52140',
  'Toyota Genuine Parts', 155.00, '/repuestos/zapatas.jpg', 12,
  '{"diametro_tambor_mm":200,"incluye_resortes":true}', false),

 ('TOY-MOT-0001','bujias-iridio-90919-01253',
  'Bujías de iridio 90919-01253 (juego x4)',
  'Bujías de electrodo de iridio con vida útil de hasta 100 000 km. Mejoran el arranque en frío y la estabilidad del ralentí.',
  (select id from public.categorias where slug='motor'), '90919-01253',
  'Denso', 320.00, '/repuestos/bujias.jpg', 24,
  '{"material":"iridio","piezas":4,"gap_mm":1.1}', true),

 ('TOY-MOT-0002','correa-accesorios-90916-02660',
  'Correa de accesorios 90916-02660',
  'Correa poli-V de caucho EPDM que mueve alternador, dirección hidráulica y compresor A/C. Resistente al agrietamiento por calor.',
  (select id from public.categorias where slug='motor'), '90916-02660',
  'Toyota Genuine Parts', 130.00, '/repuestos/correa.jpg', 12,
  '{"perfil":"6PK","largo_mm":1875}', false),

 ('TOY-MOT-0003','bomba-agua-16100-09520',
  'Bomba de agua 16100-09520',
  'Bomba con sello mecánico reforzado y rodamiento sellado. Incluye empaquetadura. Cambio recomendado junto con el kit de distribución.',
  (select id from public.categorias where slug='motor'), '16100-09520',
  'Aisin', 590.00, '/repuestos/bomba-agua.jpg', 12,
  '{"incluye_empaquetadura":true}', false),

 ('TOY-MOT-0004','kit-distribucion-cadena-13506-0l010',
  'Kit de distribución por cadena 13506-0L010',
  'Kit completo: cadena, tensor hidráulico, guías y piñones. Para motores 2KD-FTV y 1KD-FTV.',
  (select id from public.categorias where slug='motor'), '13506-0L010',
  'Toyota Genuine Parts', 1250.00, '/repuestos/kit-distribucion.jpg', 12,
  '{"piezas":6,"tipo":"cadena"}', false),

 ('TOY-MOT-0005','radiador-16400-0l340',
  'Radiador de motor 16400-0L340',
  'Radiador de núcleo de aluminio y tanques de polímero, con mayor superficie de intercambio para uso en carretera y altura.',
  (select id from public.categorias where slug='motor'), '16400-0L340',
  'Denso', 780.00, '/repuestos/radiador.jpg', 12,
  '{"material":"aluminio","filas":2}', false),

 ('TOY-SUS-0001','amortiguador-delantero-48510-09',
  'Amortiguador delantero (unidad)',
  'Amortiguador bitubo a gas, calibrado según especificación original. Se recomienda cambiar en pares por eje.',
  (select id from public.categorias where slug='suspension'), '48510-09L20',
  'KYB', 395.00, '/repuestos/amortiguador.jpg', 12,
  '{"tipo":"bitubo a gas","posicion":"delantero"}', false),

 ('TOY-SUS-0002','rotula-suspension-43330-09780',
  'Rótula de suspensión inferior 43330-09780',
  'Rótula con guardapolvo reforzado y grasa de litio de larga duración. Elimina el juego en la dirección.',
  (select id from public.categorias where slug='suspension'), '43330-09780',
  'Toyota Genuine Parts', 165.00, '/repuestos/rotula.jpg', 12,
  '{"posicion":"inferior","incluye_guardapolvo":true}', false),

 ('TOY-SUS-0003','terminal-direccion-45046-09281',
  'Terminal de dirección 45046-09281',
  'Terminal exterior de dirección. Requiere alineamiento posterior a la instalación.',
  (select id from public.categorias where slug='suspension'), '45046-09281',
  'Toyota Genuine Parts', 120.00, '/repuestos/terminal-direccion.jpg', 12,
  '{"rosca":"M14 x 1.5"}', false),

 ('TOY-ELE-0001','bateria-12v-60ah',
  'Batería Toyota 12V 60Ah 500CCA',
  'Batería libre de mantenimiento con indicador de carga. Arranque confiable en climas costeros húmedos.',
  (select id from public.categorias where slug='electrico'), '28800-0M010',
  'Toyota Genuine Parts', 480.00, '/repuestos/bateria.jpg', 18,
  '{"voltaje":12,"amperaje_ah":60,"cca":500}', true),

 ('TOY-ELE-0002','alternador-27060-0t090',
  'Alternador 27060-0T090 (100A)',
  'Alternador remanufacturado con regulador integrado y rectificador nuevo. Probado en banco antes del despacho.',
  (select id from public.categorias where slug='electrico'), '27060-0T090',
  'Denso', 1150.00, '/repuestos/alternador.jpg', 12,
  '{"amperaje":100,"remanufacturado":true}', false),

 ('TOY-ELE-0003','faro-led-derecho-81110-02m40',
  'Faro delantero LED derecho 81110-02M40',
  'Faro con proyector LED y luz de circulación diurna integrada. Carcasa sellada contra humedad.',
  (select id from public.categorias where slug='electrico'), '81110-02M40',
  'Toyota Genuine Parts', 890.00, '/repuestos/faro-led.jpg', 12,
  '{"lado":"derecho","tecnologia":"LED"}', false),

 ('TOY-LUB-0001','aceite-5w30-sintetico-4l',
  'Aceite Toyota 5W-30 sintético (4 L)',
  'Aceite full sintético API SP para motores a gasolina. Protege contra el desgaste en marcha lenta prolongada.',
  (select id from public.categorias where slug='lubricantes'), '08880-83944',
  'Toyota Genuine Parts', 210.00, '/repuestos/aceite-5w30.jpg', 36,
  '{"viscosidad":"5W-30","volumen_l":4,"norma":"API SP"}', true),

 ('TOY-LUB-0002','refrigerante-sllc-rosado-1l',
  'Refrigerante Toyota SLLC rosado (1 L)',
  'Refrigerante de larga duración listo para usar, sin silicatos ni aminas. No mezclar con refrigerantes verdes.',
  (select id from public.categorias where slug='lubricantes'), '08889-80072',
  'Toyota Genuine Parts', 55.00, '/repuestos/refrigerante.jpg', 36,
  '{"color":"rosado","listo_para_usar":true,"volumen_l":1}', false),

 ('TOY-TRA-0001','kit-embrague-31250-0k180',
  'Kit de embrague 31250-0K180',
  'Kit completo: disco, prensa y collarín. Para transmisión manual de 5 velocidades.',
  (select id from public.categorias where slug='transmision'), '31250-0K180',
  'Aisin', 1480.00, '/repuestos/kit-embrague.jpg', 12,
  '{"piezas":3,"diametro_disco_mm":236}', false),

 ('TOY-ACC-0001','plumillas-limpiaparabrisas-par',
  'Plumillas limpiaparabrisas (par)',
  'Juego de plumillas planas con adaptador universal y goma de grafito. Barrido silencioso y sin marcas.',
  (select id from public.categorias where slug='accesorios'), '85222-02350',
  'Toyota Genuine Parts', 85.00, '/repuestos/plumillas.jpg', 6,
  '{"medidas_cm":[65,40],"piezas":2}', false);

-- ─────────────────────── Compatibilidad ────────────────────────────
insert into public.repuesto_compatibilidad (repuesto_id, modelo_id, anio_desde, anio_hasta)
select r.id, m.id, x.desde, x.hasta
from (values
  ('TOY-FIL-0001','corolla', 2008, null), ('TOY-FIL-0001','yaris',  2010, null),
  ('TOY-FIL-0001','rav4',    2010, null), ('TOY-FIL-0001','camry',  2010, null),
  ('TOY-FIL-0002','corolla', 2014, null), ('TOY-FIL-0002','yaris',  2014, null),
  ('TOY-FIL-0003','hilux',   2016, null), ('TOY-FIL-0003','fortuner',2016, null),
  ('TOY-FIL-0004','corolla', 2014, null), ('TOY-FIL-0004','rav4',   2013, null),
  ('TOY-FRE-0001','corolla', 2014, null), ('TOY-FRE-0001','yaris',  2014, null),
  ('TOY-FRE-0002','rav4',    2013, null), ('TOY-FRE-0002','camry',  2012, null),
  ('TOY-FRE-0003','corolla', 2014, null),
  ('TOY-FRE-0004','corolla', 2000, null), ('TOY-FRE-0004','hilux',  2005, null),
  ('TOY-FRE-0005','yaris',   2010, 2019),
  ('TOY-MOT-0001','corolla', 2014, null), ('TOY-MOT-0001','yaris',  2014, null),
  ('TOY-MOT-0002','hilux',   2012, null),
  ('TOY-MOT-0003','hilux',   2012, null), ('TOY-MOT-0003','fortuner',2012, null),
  ('TOY-MOT-0004','hilux',   2012, null),
  ('TOY-MOT-0005','hilux',   2016, null),
  ('TOY-SUS-0001','corolla', 2014, null),
  ('TOY-SUS-0002','yaris',   2014, null),
  ('TOY-SUS-0003','corolla', 2014, null),
  ('TOY-ELE-0001','corolla', 2010, null), ('TOY-ELE-0001','yaris',  2010, null),
  ('TOY-ELE-0001','rav4',    2010, null),
  ('TOY-ELE-0002','corolla', 2014, null),
  ('TOY-ELE-0003','corolla', 2017, null),
  ('TOY-LUB-0001','corolla', 2010, null), ('TOY-LUB-0001','yaris',  2010, null),
  ('TOY-LUB-0001','rav4',    2010, null), ('TOY-LUB-0001','prius',  2012, null),
  ('TOY-LUB-0002','corolla', 2005, null), ('TOY-LUB-0002','hilux',  2005, null),
  ('TOY-TRA-0001','hilux',   2012, null),
  ('TOY-ACC-0001','corolla', 2010, null), ('TOY-ACC-0001','yaris',  2010, null)
) as x(sku, modelo, desde, hasta)
join public.repuestos r      on r.sku  = x.sku
join public.modelos_toyota m on m.slug = x.modelo;

-- Regla operativa del seed: ningún repuesto queda sin al menos un
-- modelo compatible. Cualquier SKU que no haya recibido compatibilidad
-- explícita arriba se asocia como mínimo a los 4 modelos más vendidos
-- (Corolla, Yaris, Hilux, RAV4) — cobertura razonable para piezas
-- universales como líquidos, aceite y plumillas.
insert into public.repuesto_compatibilidad (repuesto_id, modelo_id, anio_desde, anio_hasta)
select r.id, m.id, null, null
from public.repuestos r
join public.modelos_toyota m on m.slug in ('corolla','yaris','hilux','rav4')
where not exists (
  select 1 from public.repuesto_compatibilidad rc where rc.repuesto_id = r.id
);

-- ───────────────────────────  Inventario  ──────────────────────────
-- Casos de prueba deliberados:
--   TOY-ELE-0002 y TOY-MOT-0004 → stock 0 (flujo "agotado")
--   TOY-FRE-0003 y TOY-TRA-0001 → stock 1-2 ("últimas unidades")
insert into public.inventario (repuesto_id, stock, stock_minimo, ubicacion, dias_reposicion)
select r.id, x.stock, x.minimo, x.ubic, x.dias
from (values
  ('TOY-FIL-0001', 48, 10, 'A-01-04',  5),
  ('TOY-FIL-0002', 22,  6, 'A-01-08',  5),
  ('TOY-FIL-0003', 14,  4, 'A-02-01',  7),
  ('TOY-FIL-0004', 31,  8, 'A-02-05',  5),
  ('TOY-FRE-0001', 18,  6, 'B-01-02',  7),
  ('TOY-FRE-0002', 12,  4, 'B-01-06',  7),
  ('TOY-FRE-0003',  2,  4, 'B-02-01', 10),
  ('TOY-FRE-0004', 40, 10, 'B-03-03',  5),
  ('TOY-FRE-0005',  9,  3, 'B-02-07',  7),
  ('TOY-MOT-0001', 26,  8, 'C-01-01',  7),
  ('TOY-MOT-0002', 11,  4, 'C-01-05',  7),
  ('TOY-MOT-0003',  6,  2, 'C-02-02', 14),
  ('TOY-MOT-0004',  0,  2, 'C-02-08', 21),
  ('TOY-MOT-0005',  4,  2, 'C-03-01', 14),
  ('TOY-SUS-0001',  8,  4, 'D-01-03', 10),
  ('TOY-SUS-0002', 15,  5, 'D-01-07', 10),
  ('TOY-SUS-0003', 17,  5, 'D-02-02', 10),
  ('TOY-ELE-0001', 10,  3, 'E-01-01',  7),
  ('TOY-ELE-0002',  0,  1, 'E-02-04', 21),
  ('TOY-ELE-0003',  3,  1, 'E-03-02', 14),
  ('TOY-LUB-0001', 35, 10, 'F-01-01',  5),
  ('TOY-LUB-0002', 52, 12, 'F-01-05',  5),
  ('TOY-TRA-0001',  1,  1, 'G-01-01', 21),
  ('TOY-ACC-0001', 44, 10, 'H-01-02',  5)
) as x(sku, stock, minimo, ubic, dias)
join public.repuestos r on r.sku = x.sku;

-- ─────────────── Los 3 tipos de mantenimiento del taller ───────────
insert into public.mantenimientos
 (slug, nombre, descripcion, duracion_minutos, precio, intervalo_km, incluye, imagen_url, orden) values

 ('express-5k', 'Servicio Express 5K',
  'Mantenimiento preventivo rápido cada 5 000 km. Es el servicio de rutina que mantiene vigente la garantía de fábrica y detecta desgastes temprano. Ideal para uso urbano intenso en Lima.',
  60, 189.00, 5000,
  array[
    'Cambio de aceite sintético 5W-30 (hasta 4 L)',
    'Cambio de filtro de aceite original',
    'Revisión y completado de los 8 niveles',
    'Inspección visual de frenos y neumáticos',
    'Calibración de presión de llantas',
    'Escaneo rápido de códigos de falla',
    'Informe digital del estado del vehículo'
  ],
  '/mantenimientos/express-5k.jpg', 1),

 ('preventivo-20k', 'Mantenimiento Preventivo 20K',
  'Servicio intermedio cada 20 000 km. Suma al Express la renovación de filtros de aire y cabina, rotación de neumáticos y revisión del sistema de frenos con desmontaje de ruedas.',
  60, 449.00, 20000,
  array[
    'Todo lo incluido en el Servicio Express 5K',
    'Cambio de filtro de aire de motor',
    'Cambio de filtro de aire de cabina',
    'Rotación y balanceo de los 4 neumáticos',
    'Revisión de pastillas y discos con desmontaje',
    'Limpieza de cuerpo de aceleración',
    'Revisión de batería y sistema de carga',
    'Diagnóstico computarizado completo'
  ],
  '/mantenimientos/preventivo-20k.svg', 2),

 ('mayor-40k', 'Mantenimiento Mayor 40K',
  'Servicio integral cada 40 000 km. Es la revisión más profunda del taller: incorpora bujías, líquido de frenos, refrigerante y una inspección de 60 puntos con alineamiento incluido.',
  60, 899.00, 40000,
  array[
    'Todo lo incluido en el Mantenimiento Preventivo 20K',
    'Cambio de bujías de iridio (juego x4)',
    'Cambio de líquido de frenos DOT 4',
    'Cambio de refrigerante SLLC',
    'Cambio de filtro de combustible',
    'Inspección de 60 puntos con informe fotográfico',
    'Alineamiento y balanceo computarizado',
    'Limpieza de inyectores',
    'Lavado y aspirado de cortesía'
  ],
  '/mantenimientos/mayor-40k.jpg', 3);

-- ─────────────── Base de conocimiento Toyota (F3) ──────────────────
insert into public.faq_toyota (pregunta, respuesta, categoria, modelos, tags) values

 ('¿Cada cuántos kilómetros debo hacer el mantenimiento de mi Toyota?',
  'Toyota recomienda un servicio preventivo cada 5 000 km o 6 meses, lo que ocurra primero. En Lima, por el tráfico denso y el polvo, conviene respetar el intervalo por tiempo aunque no se llegue al kilometraje. Los servicios mayores se hacen cada 20 000 km y cada 40 000 km.',
  'mantenimiento', '{}', '{intervalo,kilometraje,preventivo}'),

 ('¿Qué aceite necesita mi Toyota Corolla?',
  'Los Corolla desde 2010 con motor a gasolina usan aceite full sintético 5W-30 con norma API SP. La capacidad típica es de 4.2 litros con cambio de filtro. Para motores más antiguos o con alto kilometraje puede recomendarse 10W-30. Nunca mezcle viscosidades distintas.',
  'mantenimiento', '{Corolla}', '{aceite,5w30,sintetico}'),

 ('¿Cuándo debo cambiar las pastillas de freno?',
  'Las pastillas delanteras duran entre 30 000 y 50 000 km según el estilo de manejo. Cámbielas si el espesor del material es menor a 3 mm, si escucha un chirrido metálico agudo al frenar o si el pedal vibra. Las pastillas Toyota traen un indicador acústico que avisa antes de dañar el disco.',
  'mantenimiento', '{}', '{frenos,pastillas,desgaste}'),

 ('¿Cuál es la diferencia entre un repuesto genuino Toyota y uno alternativo?',
  'El repuesto genuino se fabrica bajo las tolerancias exactas del diseño original, viene con garantía de 12 meses y no afecta la garantía de fábrica del vehículo. Un repuesto alternativo puede costar menos, pero varía en material y ajuste. En piezas de seguridad (frenos, dirección, suspensión) recomendamos siempre genuino.',
  'repuestos', '{}', '{genuino,alternativo,garantia,calidad}'),

 ('¿Mi Toyota tiene correa o cadena de distribución?',
  'La mayoría de motores Toyota modernos usa cadena de distribución, diseñada para durar la vida del motor con el aceite correcto. Los motores diésel 2KD-FTV y 1KD-FTV de Hilux y Fortuner usan cadena con tensor hidráulico, que se revisa a los 150 000 km. Algunos motores anteriores a 2005 usan correa, con cambio cada 100 000 km.',
  'mantenimiento', '{Hilux,Fortuner}', '{distribucion,correa,cadena}'),

 ('Se encendió la luz check engine, ¿qué hago?',
  'Si la luz está fija, el vehículo puede circular pero necesita diagnóstico pronto: suele deberse a sensores de oxígeno, tapa de combustible mal cerrada o el sistema de emisiones. Si la luz parpadea, detenga el vehículo: indica una falla de encendido que puede dañar el catalizador. En el taller hacemos el escaneo computarizado y le entregamos el código exacto.',
  'general', '{}', '{check-engine,diagnostico,tablero}'),

 ('¿Qué refrigerante usa Toyota?',
  'Toyota usa refrigerante SLLC (Super Long Life Coolant) de color rosado, libre de silicatos y aminas, que viene listo para usar sin diluir. Dura hasta 160 000 km o 10 años en el primer cambio, y luego cada 80 000 km. No lo mezcle con refrigerante verde convencional: la mezcla forma depósitos que tapan el radiador.',
  'mantenimiento', '{}', '{refrigerante,sllc,rosado}'),

 ('¿Cada cuánto se cambian las bujías?',
  'Las bujías de iridio originales duran hasta 100 000 km. Las de níquel, entre 20 000 y 30 000 km. Señales de desgaste: arranque difícil en frío, ralentí inestable, pérdida de potencia al subir cuestas y mayor consumo de combustible. Se cambian siempre en juego completo, nunca de forma individual.',
  'mantenimiento', '{}', '{bujias,iridio,encendido}'),

 ('¿Cuánto dura la batería de un Toyota?',
  'Entre 3 y 5 años en clima costero. La humedad de Lima acelera la sulfatación de bornes. Señales de fin de vida: arranque lento en las mañanas, luces que bajan de intensidad al encender el motor y el indicador de carga oscuro. En el taller medimos el estado con probador de carga sin costo.',
  'repuestos', '{}', '{bateria,arranque,electrico}'),

 ('¿Cada cuánto cambio el filtro de aire de cabina?',
  'Cada 15 000 km o una vez al año. En Lima, si maneja a diario en avenidas con tráfico pesado, conviene hacerlo cada 10 000 km. Un filtro saturado reduce el flujo del aire acondicionado, empaña los vidrios y genera olor a humedad.',
  'mantenimiento', '{}', '{filtro,cabina,polen,aire-acondicionado}'),

 ('¿Qué mantenimiento necesita un Toyota Prius híbrido?',
  'El Prius sigue el mismo esquema de mantenimiento cada 5 000 km para aceite y filtros, pero suma la revisión del sistema híbrido: estado de la batería de alto voltaje, refrigeración del inverter y limpieza del ventilador de la batería. Sus frenos duran más por el frenado regenerativo, pero el líquido de frenos igual se cambia cada 2 años.',
  'mantenimiento', '{Prius}', '{hibrido,prius,bateria-alto-voltaje}'),

 ('¿Qué garantía tienen los repuestos que venden?',
  'Los repuestos genuinos Toyota tienen 12 meses de garantía contra defectos de fabricación. Los lubricantes y refrigerantes, 36 meses de vida en almacén sin abrir. Las baterías tienen 18 meses. La garantía cubre el repuesto, y si fue instalado en nuestro taller también cubre la mano de obra del reemplazo.',
  'garantia', '{}', '{garantia,cobertura,repuestos}');

-- ─────────────── Citas de prueba (para demostrar F4) ───────────────
-- Se calculan relativas a la fecha de ejecución para que siempre sean
-- futuras. date_trunc('week', …) devuelve el lunes de la semana actual.
insert into public.citas
 (nombre_cliente, email, telefono, modelo_vehiculo, anio_vehiculo, placa,
  mantenimiento_id, inicio, fin, estado, origen, notas, cancelada_en)
select x.nombre, x.email, x.tel, x.modelo, x.anio, x.placa, m.id,
       x.inicio, x.inicio + interval '60 minutes',
       x.estado, x.origen, x.notas,
       case when x.estado = 'cancelada' then now() else null end
from (
  values
    ('Ana Quispe','ana.quispe@ejemplo.com','987654321','Toyota Hilux',2020,'ABC-123',
     'preventivo-20k',
     ((date_trunc('week', (now() at time zone 'America/Lima'))
       + interval '7 days' + interval '10 hours') at time zone 'America/Lima'),
     'confirmada','web','Cliente frecuente. Revisar ruido en suspensión delantera.'),

    ('Carlos Ríos','carlos.rios@ejemplo.com','912345678','Toyota Corolla',2018,'XYZ-789',
     'express-5k',
     ((date_trunc('week', (now() at time zone 'America/Lima'))
       + interval '8 days' + interval '15 hours') at time zone 'America/Lima'),
     'confirmada','chat',null),

    ('Ana Quispe','ana.quispe@ejemplo.com','987654321','Toyota Hilux',2020,'ABC-123',
     'mayor-40k',
     ((date_trunc('week', (now() at time zone 'America/Lima'))
       + interval '9 days' + interval '9 hours') at time zone 'America/Lima'),
     'cancelada','chat','Cancelada por el cliente: viaje de trabajo.')
) as x(nombre, email, tel, modelo, anio, placa, servicio, inicio, estado, origen, notas)
join public.mantenimientos m on m.slug = x.servicio;
