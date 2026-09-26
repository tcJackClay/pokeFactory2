import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { GameViewSectionProps } from './shared';

const sourceLinks = {
  pokemon: 'https://support.pokemon.com/hc/en-us/articles/360000634094-Can-I-use-Pok%C3%A9mon-images-or-materials',
  pokeApi: 'https://github.com/PokeAPI/pokeapi',
  pokeApiLicense: 'https://github.com/PokeAPI/pokeapi/blob/master/LICENSE.md',
  sprites: 'https://github.com/PokeAPI/sprites',
  spriteLicense: 'https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt',
  cries: 'https://github.com/PokeAPI/cries',
  fiftyTwoPoke: 'https://wiki.52poke.com/wiki/%E5%B1%9E%E6%80%A7',
  pokeRogueAssets: 'https://github.com/pagefaultgames/pokerogue-assets',
  pokeRogueLicense: 'https://github.com/pagefaultgames/pokerogue-assets/blob/35c1ee6/images/REUSE.toml',
  pokeRogueRules: 'https://github.com/pagefaultgames/pokerogue',
} as const;

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 font-bold text-sky-700 underline decoration-sky-300 underline-offset-2 break-words focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
    >
      <span>{children}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}

export function CreditsScreen({ viewModel }: GameViewSectionProps) {
  const { currentLanguage, setGameState } = viewModel;
  const isZh = currentLanguage.startsWith('zh');
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      key="credits"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      className="pf-system-page"
    >
      <div className="pf-system-header flex-wrap">
        <h2 className={`min-w-0 text-slate-950 ${isZh ? 'text-[28px] font-black' : 'text-[24px] font-black uppercase tracking-[0.03em]'}`}>
          {isZh ? '版权与素材来源' : 'Credits and Sources'}
        </h2>
        <button
          type="button"
          onClick={() => setGameState('SETTINGS')}
          className="pf-action-button shrink-0 px-3"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{isZh ? '返回设置' : 'Settings'}</span>
        </button>
      </div>

      <div className="relative z-10 min-h-0 flex-1 px-3 pb-3">
        <div className="custom-scrollbar h-full overflow-y-auto overscroll-contain pr-1">
          <div className="mx-auto grid max-w-3xl gap-3 pb-2 text-sm leading-relaxed text-slate-700">
            <section className="pf-settings-card">
              <h3 className="text-base font-black text-slate-900">{isZh ? '项目性质与关系' : 'Project and relationship'}</h3>
              <p className="mt-2">
                {isZh
                  ? 'PokeFactory2 是独立制作的非商业游戏项目，与 The Pokémon Company、Nintendo、Game Freak、Creatures 或 PokéAPI 没有官方关联或背书。宝可梦名称、角色、形象及相关素材的权利归各自权利人所有。非商业性质和来源署名不代表已获得相关知识产权的使用许可。'
                  : 'PokeFactory2 is an independently made, noncommercial game project. It is not affiliated with or endorsed by The Pokémon Company, Nintendo, Game Freak, Creatures, or PokéAPI. Pokémon names, characters, images, and related materials belong to their respective rights holders. Noncommercial use and attribution do not mean that permission to use this intellectual property has been granted.'}
              </p>
              <p className="mt-2">
                <SourceLink href={sourceLinks.pokemon}>{isZh ? '宝可梦官方内容使用说明' : 'Official Pokémon content-use guidance'}</SourceLink>
              </p>
            </section>

            <section className="pf-settings-card">
              <h3 className="text-base font-black text-slate-900">{isZh ? '资料、图像与声音' : 'Data, images, and audio'}</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>
                  {isZh ? '宝可梦资料使用 PokéAPI 数据，感谢其贡献者。' : 'Pokémon data uses PokéAPI data. Thanks to its contributors.'}{' '}
                  <SourceLink href={sourceLinks.pokeApi}>PokéAPI</SourceLink>{' · '}
                  <SourceLink href={sourceLinks.pokeApiLicense}>{isZh ? '项目许可' : 'Project license'}</SourceLink>
                </li>
                <li>
                  {isZh ? '部分图像来自 PokeAPI/sprites。该仓库的许可文件声明图像内容版权属于 The Pokémon Company。' : 'Some images come from PokeAPI/sprites. Its license file states that image contents are copyright The Pokémon Company.'}{' '}
                  <SourceLink href={sourceLinks.sprites}>PokeAPI/sprites</SourceLink>{' · '}
                  <SourceLink href={sourceLinks.spriteLicense}>{isZh ? '来源说明' : 'Source notice'}</SourceLink>
                </li>
                <li>
                  {isZh ? '部分宝可梦叫声通过 PokeAPI/cries 提供。' : 'Some Pokémon cries are provided through PokeAPI/cries.'}{' '}
                  <SourceLink href={sourceLinks.cries}>PokeAPI/cries</SourceLink>
                </li>
              </ul>
            </section>

            <section className="pf-settings-card">
              <h3 className="text-base font-black text-slate-900">{isZh ? '其他素材与开发参考' : 'Other assets and development references'}</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>
                  {isZh ? '属性图标提取自 52Poké 属性页面的图集，并为游戏显示作适配。' : 'Type icons were extracted from the 52Poké type page sprite sheet and adapted for display in this game.'}{' '}
                  <SourceLink href={sourceLinks.fiftyTwoPoke}>52Poké</SourceLink>
                </li>
                <li>
                  {isZh ? '部分战斗场地素材来自 PokeRogue Assets，来源提交 35c1ee6。来源仓库将相关文件标记为 AGPL-3.0-only。' : 'Some battle arena assets come from PokeRogue Assets at commit 35c1ee6. The source repository marks the relevant files AGPL-3.0-only.'}{' '}
                  <SourceLink href={sourceLinks.pokeRogueAssets}>PokeRogue Assets</SourceLink>{' · '}
                  <SourceLink href={sourceLinks.pokeRogueLicense}>{isZh ? '来源许可标记' : 'Source license marker'}</SourceLink>
                </li>
                <li>
                  {isZh ? '部分战斗计算规则参考 PokeRogue 项目。' : 'Some battle calculations refer to the PokeRogue project.'}{' '}
                  <SourceLink href={sourceLinks.pokeRogueRules}>PokeRogue</SourceLink>
                </li>
              </ul>
            </section>

            <p className="px-2 text-xs text-slate-500">
              {isZh
                ? '以上来源按当前项目使用情况列出。素材清单与权利状态将在公开发布前继续核对。'
                : 'These sources reflect current project usage. The asset inventory and rights status will be reviewed further before public release.'}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
