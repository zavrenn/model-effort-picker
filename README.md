# Worth the switch?

A one-page tool that answers a simple question: should you switch AI models (or effort levels)?

Pick the model you use **now** and the one you're **considering**, then say what matters more to you, from *Cheapest* to *Smartest*. You get a verdict, and two bars show how the test score and the API cost per task change.

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

*Cheapest* ranks by cost alone and *Smartest* by score alone; the other measure only breaks ties.

Scores are scaled to 0–100 for the ranking.

## Update the data

All the numbers live in [`src/data.js`](src/data.js). Edit that file and reload; no code changes are needed. Values marked `approx` were read from a chart rather than a published table.

## Files

| File | What it does |
|---|---|
| `index.html` | Page layout |
| `src/data.js` | Models, effort levels, scores and costs |
| `src/value.js` | Value score and the priority choices |
| `src/main.js` | Wires the pickers, verdict, bars and ranking together |
| `src/styles.css` | Styles |

## Data source

Benchmark scores and costs come from [Artificial Analysis](https://artificialanalysis.ai/).

## License

Code: [MIT](LICENSE). Benchmark data belongs to Artificial Analysis.
