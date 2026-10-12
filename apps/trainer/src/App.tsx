import { loadBundle } from '@lens/scenes';
import { DevScenes } from './dev/DevScenes';
import { Play } from './play/Play';

// Minimal path switch; no router library.
export function App() {
  const path = window.location.pathname;
  if (path.startsWith('/dev/scenes')) return <DevScenes />;
  const play = /^\/play\/([\w-]+)\/?$/.exec(path);
  if (play) return <Play cardId={play[1]!} />;
  return <Home />;
}

// WO-001 placeholder: list every card from the bundle.
function Home() {
  const { cards } = loadBundle();

  return (
    <main>
      <h1>視点レンズ</h1>
      <table>
        <thead>
          <tr>
            <th>id</th>
            <th>lens</th>
            <th>answer</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id}>
              <td>{card.id}</td>
              <td>{card.lens}</td>
              <td>{card.answer.display_ja ?? card.answer.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <a href="/play/enclose-001">/play/enclose-001</a> · <a href="/dev/scenes">/dev/scenes</a>
      </p>
    </main>
  );
}
