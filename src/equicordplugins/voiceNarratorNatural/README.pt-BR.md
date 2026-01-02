# VoiceNarratorNatural

Um plugin de TTS (Text-to-Speech) para [Vencord](https://vencord.dev/) / [Equicord](https://github.com/Equicord/Equicord) que anuncia eventos de canais de voz usando Vozes Naturais do Windows via SAPI5.

## Funcionalidades

- 🎙️ **Anúncios de Canal de Voz** - Anuncia quando usuários entram, saem ou se movem entre canais de voz
- 🔇 **Detecção de Mute/Deafen** - Anuncia quando qualquer usuário no seu canal muta/desmuta ou ensurdece/desensurdece
- 🗣️ **Vozes Naturais do Windows** - Suporte para vozes Microsoft Natural de alta qualidade via SAPI5
- 💬 **Falar Mensagem** - Clique com botão direito em qualquer mensagem para ouvi-la em voz alta
- ⚙️ **Mensagens Personalizáveis** - Mensagens de anúncio totalmente personalizáveis com variáveis

## Instalação

### Como Userplugin

1. Clone este repositório na pasta userplugins do seu Vencord/Equicord:
   ```bash
   cd src/userplugins
   git clone https://github.com/srmooon/VoiceNarratorNatural.git
   ```

2. Compile e injete:
   ```bash
   pnpm build
   pnpm inject
   ```

3. Reinicie o Discord e ative o plugin nas configurações.

## Configuração das Vozes Naturais SAPI5

Para usar as Vozes Naturais do Windows (como Microsoft Antonio, Francisca, etc.), você precisa instalar o [NaturalVoiceSAPIAdapter](https://github.com/gexgd0419/NaturalVoiceSAPIAdapter).

### ⚠️ Requisitos Importantes

- **Você DEVE clicar em AMBOS os botões "Install 32-bit" E "Install 64-bit"** dentro do instalador do NaturalVoiceSAPIAdapter para o plugin funcionar corretamente
- **Recomendado**: Instale as vozes no modo "Local" para melhor desempenho e confiabilidade (vozes online podem ter problemas de latência)

### Passos de Instalação

1. Baixe o NaturalVoiceSAPIAdapter pelo link acima
2. Abra o instalador e **clique em ambos os botões "Install 32-bit" e "Install 64-bit"** (isso é obrigatório!)
3. Abra o NaturalVoiceSAPIAdapter e selecione as vozes que deseja usar
4. **Recomendado**: Escolha o modo de instalação "Local" para cada voz
5. Nas configurações do plugin, selecione "SAPI5" como Provedor de TTS
6. Clique em "Install SAPI5" para baixar os componentes Python necessários (~20MB)
7. Selecione sua voz preferida no dropdown

## Variáveis das Mensagens

Você pode personalizar as mensagens de anúncio usando estas variáveis:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{nickname}` | Apelido do usuário no servidor | Moon |
| `{display_name}` | Nome de exibição global do usuário | SrMoon |
| `{username}` | Nome de usuário | srmoon |
| `{channel}` | Nome do canal de voz | Geral |
| `{server}` | Nome do servidor | Meu Servidor |

### Mensagens Padrão

- **Entrar**: `{nickname} entered the voice`
- **Sair**: `{nickname} left the voice`
- **Mover**: `{nickname} moved to {channel}`
- **Mutar**: `{nickname} muted`
- **Desmutar**: `{nickname} unmuted`
- **Ensurdecer**: `{nickname} deafened`
- **Desensurdecer**: `{nickname} undeafened`

## Configurações

- **TTS Provider** - Escolha entre System (vozes do navegador) ou SAPI5 (Vozes Naturais do Windows)
- **System Voice** - Selecione uma voz das vozes disponíveis do seu sistema
- **SAPI5 Voice** - Selecione uma voz natural (requer configuração do SAPI5)
- **Volume** - Ajuste o volume do narrador (0-100%)
- **Speed** - Ajuste a velocidade da fala
- **Announce yourself** - Ativa/desativa anunciar suas próprias ações
- **Strip non-latin characters** - Remove caracteres especiais dos nomes

## Autor

**SrMoon** - [GitHub](https://github.com/srmooon)

## Licença

GPL-3.0-or-later
