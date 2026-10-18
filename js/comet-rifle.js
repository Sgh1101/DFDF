(() => {
  'use strict';
  if(window.GUNSYNTH?.SPEC.bullpup)Object.assign(GUNSYNTH.SPEC.bullpup,{ko:'코멧 소총',rpm:750});
  // An original DFDF bullpup: rear magazine, open thumbhole stock, vented
  // ivory receiver and exposed copper heat shield. No imported rifle clone.
  GUN_BUILD.bullpup=()=>{
    const b=GunBuilder(),M=GUNMAT,body=M.tan(),metal=M.gunmetal(),dark=M.black(),rubber=M.rubber(),copper=M.brass();
    b.box(body,.078,.112,.43,0,.024,-.02);
    b.box(metal,.057,.038,.36,0,.095,-.055);
    b.rail(dark,.27,0,.119,-.06);
    b.box(body,.082,.068,.19,0,-.008,.23);
    b.box(body,.082,.035,.17,0,-.122,.23);
    b.box(body,.082,.13,.035,0,-.067,.31);
    b.buttPad(rubber,.086,.17,.026,0,-.06,.345);
    b.grip(rubber,.048,.125,.07,0,-.095,.025,.15);
    b.trigger(dark,.029,0,-.035,-.015,.1);
    b.mag(metal,.055,.165,.075,0,-.13,.185,.08);
    b.box(copper,.058,.025,.08,0,-.22,.18);
    b.box(dark,.071,.084,.185,0,.015,-.29);
    b.barrel(metal,.017,.23,0,.024,-.46);
    b.flashHider(dark,.025,.065,0,.024,-.59,3);
    b.box(copper,.075,.025,.14,0,.063,-.3);
    for(const side of [-1,1]){
      for(let i=0;i<5;i++)b.box(dark,.006,.018,.013,side*.04,.038,-.17+i*.028);
      b.box(copper,.006,.011,.17,side*.043,-.005,-.02);
      b.pin(metal,.008,side*.042,.025,.125);
      b.box(dark,.006,.019,.045,side*.044,.044,.105);
    }
    b.opticMount(metal,.044,.028,.065,0,.133,-.085);
    b.box(dark,.048,.012,.055,0,.15,-.085);
    b.box(dark,.008,.043,.055,-.02,.17,-.085);
    b.box(dark,.008,.043,.055,.02,.17,-.085);
    b.box(dark,.048,.01,.055,0,.192,-.085);
    b.box(M.glass(),.032,.03,.003,0,.171,-.111);
    b.box(M.glow(0xff8d43),.003,.006,.002,0,.17,-.113);
    b.ejPort(metal,.035,.026,.07,.041,.047,.15,1);
    b.chargeHandle(metal,-.043,.064,-.1,-1);
    b.selector(metal,.043,-.018,.07,1);
    b.group.name='comet-rifle';b.group.userData.weaponModel='comet';
    return b.group;
  };
})();
