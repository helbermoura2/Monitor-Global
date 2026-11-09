package top.monitorglobal.tv;
import static org.junit.Assert.*;
import org.junit.Test;

public final class TvVoiceCommandsTest {
 @Test public void portugueseRequestsRouteToExistingCards(){
  assertEquals(TvVoiceCommands.WEATHER,TvVoiceCommands.route("Qual é a temperatura em São Paulo?"));
  assertEquals(TvVoiceCommands.WEATHER,TvVoiceCommands.route("Como está a chuva?"));
  assertEquals(TvVoiceCommands.BRENT,TvVoiceCommands.route("Mostre a cotação do Brent"));
  assertEquals(TvVoiceCommands.BRAZIL,TvVoiceCommands.route("Teve terremoto no Brasil nas últimas 24 horas?"));
  assertEquals(TvVoiceCommands.BRAZIL,TvVoiceCommands.route("Sismos brasileiros hoje"));
  assertEquals(TvVoiceCommands.TODAY,TvVoiceCommands.route("Maiores terremotos do mundo hoje"));
  assertEquals(TvVoiceCommands.YESTERDAY,TvVoiceCommands.route("Resumo dos sismos de ontem"));
  assertEquals(TvVoiceCommands.RECENT_QUAKE,TvVoiceCommands.route("Mostre o último terremoto"));
  assertEquals(TvVoiceCommands.SATELLITE,TvVoiceCommands.route("Imagem de satélite"));
  assertEquals(TvVoiceCommands.WEATHER_AI,TvVoiceCommands.route("Análise meteorológica"));
 }
 @Test public void unsupportedSubjectsAreNotInvented(){
  assertEquals(TvVoiceCommands.UNKNOWN,TvVoiceCommands.route("Qual é a hora em Tóquio?"));
  assertEquals(TvVoiceCommands.UNKNOWN,TvVoiceCommands.route("Qual é o preço do ouro?"));
  assertEquals(TvVoiceCommands.UNKNOWN,TvVoiceCommands.route(""));
  assertEquals(TvVoiceCommands.UNKNOWN,TvVoiceCommands.route(null));
 }
}
