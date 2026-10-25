# Fontes do resumo diário

- Cormorant Garamond variável: https://github.com/google/fonts/tree/main/ofl/cormorantgaramond
- Inter variável: https://github.com/google/fonts/tree/main/ofl/inter

Arquivos obtidos do repositório Google Fonts em 11/10/2026. Ambas sob SIL Open Font License, com avisos completos nos arquivos OFL adjacentes. Famílias escolhidas a partir da referência visual e da indicação do usuário; a fonte original da imagem não está identificada.

O título usa Cormorant Garamond, peso 600. Dados, números e legendas usam Inter. `tools/build-summary-editorial-assets.py` constrói os atlas offline; os arquivos TTF não são baixados durante a geração do resumo.

## Cartões sísmicos e de tsunami (editorial-v17)

Usam Rajdhani Bold no nome da marca e JetBrains Mono (600/800) nos dados, as famílias do site. Os TTF e avisos SIL OFL foram reutilizados dos assets já presentes no aplicativo Android TV do projeto. `tools/build-quake-hd-fonts.py` gera atlas offline incorporados ao Worker; o navegador carrega os mesmos TTF locais ao compartilhar. Isso não altera a tipografia do resumo diário.
