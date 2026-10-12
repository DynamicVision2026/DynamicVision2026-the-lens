import { loadBundle } from '@lens/scenes';
import { DevScenes } from './dev/DevScenes';

// Minimal path switch; no router library.
export function App() {
  if (window.location.pathname.startsWith('/dev/scenes')) return <DevScenes />;
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
        <a href="/dev/scenes">/dev/scenes</a>
      </p>
    </main>
  );
}
