# Fluxo de Desenvolvimento de Funcionalidades

Este fluxo descreve os passos para desenvolver uma nova funcionalidade no projeto.

## Passos

1. **Arquitetura e Planejamento**
   - **Responsável**: `project-ai-manager` (com apoio do usuário).
   - **Ação**: Definir o escopo, impacto no banco de dados e estrutura de componentes.

2. **Modelagem de Dados (se necessário)**
   - **Responsável**: `database-agent`.
   - **Ação**: Atualizar o arquivo `schema.prisma` e gerar a migração.

3. **Implementação do Frontend**
   - **Responsável**: `frontend-agent`.
   - **Ação**: Criar componentes, páginas e integração com APIs ou Server Actions.

4. **Revisão e Validação**
   - **Responsável**: `project-ai-manager` ou usuário.
   - **Ação**: Verificar se os padrões do projeto foram seguidos (Tailwind 4, Shadcn, etc.).
