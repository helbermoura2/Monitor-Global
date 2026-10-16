import unittest,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('cemaden',Path(__file__).parents[2]/'tools/update-cemaden-alerts.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class Cemaden(unittest.TestCase):
 def row(self):return dict(status=1,latitude=-23.55,longitude=-46.63,codibge=3550308,cod_alerta=10,nivel='Moderado',municipio='SÃO PAULO',uf='SP',evento='Movimentos de Massa - Moderado',datahoracriacao='2026-10-16 03:39:49.659',ult_atualizacao='2026-10-16 03:39:49.659')
 def test_source_clocks_are_not_assigned_a_timezone(self):
  d=module.normalize({'alertas':[self.row()]},123);self.assertEqual(d['checkedAt'],123);self.assertIsNone(d['sourceTimeZone']);self.assertEqual(d['alerts'][0]['sourceIssuedText'],'2026-10-16 03:39:49.659');self.assertEqual(d['alerts'][0]['ibge'],'3550308')
 def test_empty_current_list_is_valid_but_failed_schema_is_not(self):
  self.assertEqual(module.normalize({'alertas':[]},123)['alerts'],[])
  for x in [{},{'error':'unavailable'},{'alertas':None}]:
   with self.assertRaises(ValueError):module.normalize(x,123)
 def test_invalid_active_row_rejects_whole_snapshot_and_ended_is_excluded(self):
  with self.assertRaises(ValueError):module.normalize({'alertas':[{**self.row(),'longitude':999}]},123)
  self.assertEqual(module.normalize({'alertas':[{**self.row(),'status':0}]},123)['alerts'],[])
if __name__=='__main__':unittest.main()
