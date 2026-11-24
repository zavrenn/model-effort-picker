# Worth the switch?

A one-page tool that answers a simple question: should you switch AI models (or effort levels)?

Pick the model you use **now** and the one you're **considering**, then say what matters more to you, from *Cheapest* to *Smartest*. A balance scale tips toward the better choice and shows why: points gained, or money saved.

## Run it

Open `index.html` in a browser. There are no dependencies and no build step.

## How it decides

Each option gets a value score:

```
value = intelligence − K × log2(cost)
```

- **intelligence**: the Artificial Analysis Intelligence Index.
- **cost**: the API cost in USD per index task.
- **K**: how many points one doubling of cost is worth. It is set by "What matters more to you?".

Scores are scaled to 0–100 for the ranking.

## Update the data

All the numbers live in [`src/data.js`](src/data.js). Edit that file and reload; no code changes are needed. Values marked `approx` were read from a chart rather than a published table.

## Files

| File | What it does |
|---|---|
| `index.html` | Page layout |
| `src/data.js` | Models, effort levels, scores and costs |
| `src/value.js` | Value score and the priority choices |
| `src/scene.js` | The balance scale (SVG) |
| `src/main.js` | Wires the pickers, scale and ranking together |
| `src/styles.css` | Styles |

## Data source

Benchmark scores and costs come from [Artificial Analysis](https://artificialanalysis.ai/).

## License

Code: [MIT](LICENSE). Benchmark data belongs to Artificial Analysis.
