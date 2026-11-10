import type { CompletionCatalog, CompletionShell } from './catalog.js';

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function renderBash(catalog: CompletionCatalog): string {
  const names = catalog.commands.map((c) => c.name).join(' ');
  const cases = catalog.commands
    .map((c) => {
      const flags = c.flags.join(' ');
      return `    ${c.name}) opts=${shellQuote(flags)} ;;`;
    })
    .join('\n');
  return `# nightowl bash completion
_nightowl() {
  local cur prev opts
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W ${shellQuote(names)} -- "$cur") )
    return 0
  fi
  case "\${COMP_WORDS[1]}" in
${cases}
    *) opts="" ;;
  esac
  COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
}
complete -F _nightowl nightowl
`;
}

function renderZsh(catalog: CompletionCatalog): string {
  const cmdLines = catalog.commands
    .map((c) => `    '${c.name}:${c.summary.replace(/'/g, '')}'`)
    .join(' \\\n');
  const flagCases = catalog.commands
    .map((c) => {
      const flags = c.flags.map((f) => `'${f}'`).join(' ');
      return `      ${c.name}) _arguments ${flags} && return 0 ;;`;
    })
    .join('\n');
  return `#compdef nightowl
# nightowl zsh completion
_nightowl() {
  local -a commands
  commands=(
${cmdLines}
  )
  _arguments -C \\
    '1:command:->cmds' \\
    '*::arg:->args'
  case $state in
    cmds)
      _describe -t commands 'nightowl command' commands
      ;;
    args)
      case $words[1] in
${flagCases}
      esac
      ;;
  esac
}
compdef _nightowl nightowl
`;
}

function renderFish(catalog: CompletionCatalog): string {
  const lines: string[] = ['# nightowl fish completion'];
  for (const c of catalog.commands) {
    const desc = c.summary.replace(/'/g, "\\'");
    lines.push(
      `complete -c nightowl -n '__fish_use_subcommand' -a '${c.name}' -d '${desc}'`,
    );
    for (const flag of c.flags) {
      if (flag.startsWith('--')) {
        const long = flag.slice(2);
        lines.push(
          `complete -c nightowl -n '__fish_seen_subcommand_from ${c.name}' -l ${long}`,
        );
      } else if (flag.startsWith('-') && flag.length === 2) {
        lines.push(
          `complete -c nightowl -n '__fish_seen_subcommand_from ${c.name}' -s ${flag.slice(1)}`,
        );
      }
    }
  }
  return `${lines.join('\n')}\n`;
}

export function renderCompletion(shell: CompletionShell, catalog: CompletionCatalog): string {
  switch (shell) {
    case 'bash':
      return renderBash(catalog);
    case 'zsh':
      return renderZsh(catalog);
    case 'fish':
      return renderFish(catalog);
  }
}
