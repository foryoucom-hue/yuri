/* DROPDOWN */
(() => {
  const dropdown = document.getElementById("resourcesDropdown");
  if(!dropdown) return;

  dropdown.addEventListener("mouseenter", () => {
    dropdown.classList.add("open");
  });

  dropdown.addEventListener("mouseleave", () => {
    dropdown.classList.remove("open");
  });
})();

/* BINTANG JATUH */
(() => {
  const canvas = document.getElementById("fallingStars");
  const ctx = canvas.getContext("2d");

  let w, h;
  const stars = [];
  const COUNT = 140;

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  function rand(min,max){return Math.random()*(max-min)+min;}

  function createStar(){
    return {
      x: rand(0,w),
      y: rand(-h,0),
      r: rand(1,2.5),
      vy: rand(1.2,3.8),
      vx: rand(-0.4,0.4),
      a: rand(0.4,1)
    };
  }

  for(let i=0;i<COUNT;i++) stars.push(createStar());

  function draw(){
    ctx.clearRect(0,0,w,h);

    stars.forEach(s=>{
      s.x+=s.vx;
      s.y+=s.vy;
      s.vy+=0.01;

      ctx.beginPath();
      ctx.fillStyle=`rgba(255,255,255,${s.a})`;
      ctx.shadowBlur=15;
      ctx.shadowColor="#fff";
      ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fill();

      if(s.y>h+50){
        Object.assign(s, createStar());
        s.y = -20;
      }
    });

    requestAnimationFrame(draw);
  }

  draw();
})();