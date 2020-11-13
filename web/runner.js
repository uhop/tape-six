window.addEventListener('DOMContentLoaded', () => {
  const donut = document.querySelector('tape6-donut');
  donut.add([
    {value: 8, className: 'success'},
    {value: 4, className: 'failure'},
    {value: 3, className: 'skipped'},
    {value: 2, className: 'todo'}
  ], {
    center: {x: 100, y: 100},
    gap: 4,
    innerRadius: 40,
    radius: 90,
    startAngle: Math.PI / 2
  })
});
