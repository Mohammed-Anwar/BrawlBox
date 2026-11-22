/* Trivia Buzz: multiple-choice questions. Correct answers score 100 minus
   10 per second taken (minimum 20). Wrong or late answers score 0. */
(() => {
  const QS = [
    // Geography & Landmarks
    { q: 'What is the capital of Egypt?', o: ['Alexandria', 'Giza', 'Cairo', 'Luxor'], a: 2 },
    { q: 'Which ocean is the largest?', o: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], a: 3 },
    { q: 'How many continents are there?', o: ['5', '6', '7', '8'], a: 2 },
    { q: 'What is the longest river in the world?', o: ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], a: 1 },
    { q: 'Which country is home to the kangaroo?', o: ['Australia', 'Brazil', 'India', 'South Africa'], a: 0 },
    { q: 'What is the capital of Japan?', o: ['Seoul', 'Beijing', 'Tokyo', 'Bangkok'], a: 2 },
    { q: 'Which desert is the largest hot desert?', o: ['Gobi', 'Kalahari', 'Arabian', 'Sahara'], a: 3 },
    { q: 'In which city is the Eiffel Tower located?', o: ['London', 'Paris', 'Rome', 'Berlin'], a: 1 },
    { q: 'Which country has the largest population?', o: ['India', 'USA', 'Russia', 'Indonesia'], a: 0 },
    { q: 'What is the smallest country in the world?', o: ['Monaco', 'Malta', 'Vatican City', 'San Marino'], a: 2 },
    { q: 'Which continent is Brazil located in?', o: ['North America', 'Africa', 'Europe', 'South America'], a: 3 },
    { q: 'What is the capital of Italy?', o: ['Venice', 'Rome', 'Milan', 'Naples'], a: 1 },
    { q: 'Mount Everest is part of which mountain range?', o: ['Himalayas', 'Andes', 'Alps', 'Rockies'], a: 0 },
    { q: 'Which country is shaped like a boot?', o: ['Spain', 'Greece', 'Italy', 'Portugal'], a: 2 },
    { q: 'What is the capital of France?', o: ['Madrid', 'Berlin', 'Lisbon', 'Paris'], a: 3 },

    // Science & Space
    { q: 'Which planet is known as the Red Planet?', o: ['Venus', 'Mars', 'Jupiter', 'Saturn'], a: 1 },
    { q: 'What gas do plants absorb from the air?', o: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], a: 2 },
    { q: 'What is the largest planet in our solar system?', o: ['Jupiter', 'Saturn', 'Neptune', 'Earth'], a: 0 },
    { q: 'At what temperature does water boil (Celsius)?', o: ['50°C', '80°C', '90°C', '100°C'], a: 3 },
    { q: 'What is the chemical symbol for gold?', o: ['Go', 'Au', 'Ag', 'Gd'], a: 1 },
    { q: 'Which organ pumps blood through the human body?', o: ['Lungs', 'Brain', 'Heart', 'Liver'], a: 2 },
    { q: 'What is the closest star to Earth?', o: ['The Sun', 'Polaris', 'Sirius', 'Alpha Centauri'], a: 0 },
    { q: 'What is H2O commonly known as?', o: ['Salt', 'Oxygen', 'Sugar', 'Water'], a: 3 },
    { q: 'How many bones are in an adult human body?', o: ['186', '206', '226', '256'], a: 1 },
    { q: 'Which gas do humans need to breathe to survive?', o: ['Helium', 'Hydrogen', 'Oxygen', 'Neon'], a: 2 },
    { q: 'What force keeps us on the ground?', o: ['Gravity', 'Magnetism', 'Friction', 'Inertia'], a: 0 },
    { q: 'Which planet is famous for its prominent rings?', o: ['Mars', 'Mercury', 'Venus', 'Saturn'], a: 3 },
    { q: 'What is the speed of light faster than?', o: ['Nothing', 'Sound', 'Both A and B', 'Radio waves'], a: 1 },
    { q: 'What is the hardest natural substance on Earth?', o: ['Gold', 'Iron', 'Diamond', 'Quartz'], a: 2 },
    { q: 'Which part of a plant grows underground?', o: ['Roots', 'Leaves', 'Stem', 'Petals'], a: 0 },

    // Animals & Nature
    { q: 'How many legs does a spider have?', o: ['6', '8', '10', '12'], a: 1 },
    { q: 'Which animal says "moo"?', o: ['Sheep', 'Pig', 'Cow', 'Horse'], a: 2 },
    { q: 'What is the fastest land animal?', o: ['Cheetah', 'Lion', 'Horse', 'Gazelle'], a: 0 },
    { q: 'What is the largest mammal in the world?', o: ['Elephant', 'Giraffe', 'Hippo', 'Blue Whale'], a: 3 },
    { q: 'Which bird is known for mimicking human speech?', o: ['Eagle', 'Parrot', 'Penguin', 'Owl'], a: 1 },
    { q: 'What do pandas mostly eat?', o: ['Fish', 'Berries', 'Bamboo', 'Insects'], a: 2 },
    { q: 'How many legs does an insect have?', o: ['6', '4', '8', '10'], a: 0 },
    { q: 'Which animal is known as the "King of the Jungle"?', o: ['Tiger', 'Bear', 'Wolf', 'Lion'], a: 3 },
    { q: 'What is a baby frog called?', o: ['Calf', 'Tadpole', 'Pup', 'Cub'], a: 1 },
    { q: 'Which sea creature has eight arms?', o: ['Shark', 'Dolphin', 'Octopus', 'Crab'], a: 2 },
    { q: 'Which bird cannot fly?', o: ['Penguin', 'Sparrow', 'Falcon', 'Pigeon'], a: 0 },
    { q: 'What do bees make?', o: ['Milk', 'Silk', 'Wax only', 'Honey'], a: 3 },
    { q: 'Which animal has the longest neck?', o: ['Zebra', 'Giraffe', 'Camel', 'Ostrich'], a: 1 },
    { q: 'What is a group of wolves called?', o: ['Flock', 'Herd', 'Pack', 'School'], a: 2 },
    { q: 'Which animal carries its house on its back?', o: ['Snail', 'Frog', 'Mouse', 'Rabbit'], a: 0 },

    // Math & Numbers
    { q: 'What is 9 × 7?', o: ['63', '56', '72', '81'], a: 0 },
    { q: 'How many days are in a leap year?', o: ['365', '366', '364', '360'], a: 1 },
    { q: 'How many sides does a hexagon have?', o: ['5', '7', '6', '8'], a: 2 },
    { q: 'What is 144 ÷ 12?', o: ['10', '11', '14', '12'], a: 3 },
    { q: 'How many minutes are in 2 hours?', o: ['60', '120', '90', '180'], a: 1 },
    { q: 'What is 25% of 200?', o: ['25', '75', '50', '100'], a: 2 },
    { q: 'How many zeros are in one million?', o: ['6', '5', '7', '8'], a: 0 },
    { q: 'What is the square root of 81?', o: ['7', '8', '10', '9'], a: 3 },
    { q: 'How many degrees are in a right angle?', o: ['45', '90', '180', '360'], a: 1 },
    { q: 'What is 15 + 27?', o: ['32', '41', '42', '52'], a: 2 },
    { q: 'How many sides does a triangle have?', o: ['3', '4', '5', '2'], a: 0 },
    { q: 'What is 8 × 8?', o: ['54', '62', '68', '64'], a: 3 },
    { q: 'How many weeks are in a year?', o: ['48', '52', '50', '54'], a: 1 },
    { q: 'What is 100 - 37?', o: ['73', '67', '63', '53'], a: 2 },
    { q: 'Which number is a prime number?', o: ['17', '15', '21', '9'], a: 0 },

    // Language & Words
    { q: 'What is the opposite of "ancient"?', o: ['Old', 'Modern', 'Early', 'Past'], a: 1 },
    { q: 'How many letters are in the English alphabet?', o: ['24', '25', '26', '27'], a: 2 },
    { q: 'Which word is a verb?', o: ['Run', 'Blue', 'Table', 'Happy'], a: 0 },
    { q: 'What is the plural of "mouse"?', o: ['Mouses', 'Mices', 'Mouse', 'Mice'], a: 3 },
    { q: 'Which word means the same as "rapid"?', o: ['Slow', 'Fast', 'Heavy', 'Quiet'], a: 1 },
    { q: 'What is the opposite of "victory"?', o: ['Win', 'Triumph', 'Defeat', 'Glory'], a: 2 },
    { q: 'Which letter is silent in the word "knight"?', o: ['K', 'N', 'I', 'T'], a: 0 },
    { q: 'What do you call a word spelled the same backward?', o: ['Synonym', 'Antonym', 'Acronym', 'Palindrome'], a: 3 },
    { q: 'What is the plural of "child"?', o: ['Childs', 'Children', 'Childes', 'Childrens'], a: 1 },
    { q: 'Which word is an adjective?', o: ['Jump', 'Quickly', 'Bright', 'Singer'], a: 2 },

    // Everyday Knowledge, Food & Culture
    { q: 'How many colors are in a rainbow?', o: ['7', '5', '6', '8'], a: 0 },
    { q: 'Which fruit is yellow and curved?', o: ['Apple', 'Grape', 'Cherry', 'Banana'], a: 3 },
    { q: 'How many players are on a standard soccer team?', o: ['9', '11', '10', '12'], a: 1 },
    { q: 'What color do you get when you mix red and white?', o: ['Purple', 'Orange', 'Pink', 'Brown'], a: 2 },
    { q: 'Which instrument has 88 keys?', o: ['Piano', 'Guitar', 'Violin', 'Flute'], a: 0 },
    { q: 'In which sport do you score a "touchdown"?', o: ['Basketball', 'Tennis', 'Baseball', 'American Football'], a: 3 },
    { q: 'What is the main ingredient in guacamole?', o: ['Tomato', 'Avocado', 'Cucumber', 'Peas'], a: 1 },
    { q: 'How many wheels does a tricycle have?', o: ['1', '2', '3', '4'], a: 2 },
    { q: 'Which month has 28 or 29 days?', o: ['February', 'January', 'March', 'April'], a: 0 },
    { q: 'What color are emeralds?', o: ['Blue', 'Red', 'Yellow', 'Green'], a: 3 },

    // History, Tech & Pop Culture
    { q: 'Who painted the Mona Lisa?', o: ['Picasso', 'Da Vinci', 'Van Gogh', 'Monet'], a: 1 },
    { q: 'In which country were the Pyramids of Giza built?', o: ['Mexico', 'Peru', 'Egypt', 'Sudan'], a: 2 },
    { q: 'What does "CPU" stand for in computing?', o: ['Central Processing Unit', 'Computer Power Unit', 'Core Program Utility', 'Central Print Unit'], a: 0 },
    { q: 'Which superhero is known as the "Caped Crusader"?', o: ['Superman', 'Spider-Man', 'Iron Man', 'Batman'], a: 3 },
    { q: 'How many rings are on the Olympic flag?', o: ['4', '5', '6', '7'], a: 1 },
    { q: 'Which company created the iPhone?', o: ['Samsung', 'Microsoft', 'Apple', 'Sony'], a: 2 },
    { q: 'What is the name of the famous clock tower in London?', o: ['Big Ben', 'Eiffel Tower', 'Space Needle', 'CN Tower'], a: 0 },
    { q: 'Which chess piece can only move diagonally?', o: ['Rook', 'Knight', 'Pawn', 'Bishop'], a: 3 },
    { q: 'Who was the first person to walk on the Moon?', o: ['Buzz Aldrin', 'Neil Armstrong', 'Yuri Gagarin', 'John Glenn'], a: 1 },
    { q: 'What color is the "M" in the McDonald’s logo?', o: ['Red', 'White', 'Yellow', 'Blue'], a: 2 },

    // Extra Rapid-Fire Mix
    { q: 'How many hours are in two days?', o: ['48', '24', '36', '72'], a: 0 },
    { q: 'Which season comes after summer?', o: ['Winter', 'Spring', 'Monsoon', 'Autumn'], a: 3 },
    { q: 'What do you use to measure temperature?', o: ['Barometer', 'Thermometer', 'Compass', 'Ruler'], a: 1 },
    { q: 'Which metal is liquid at room temperature?', o: ['Iron', 'Copper', 'Mercury', 'Lead'], a: 2 },
    { q: 'How many teeth does an adult human usually have?', o: ['32', '28', '30', '36'], a: 0 },
    { q: 'What is the freezing point of water in Celsius?', o: ['10°C', '32°C', '-10°C', '0°C'], a: 3 },
    { q: 'Which sense is linked to your ears?', o: ['Sight', 'Hearing', 'Taste', 'Smell'], a: 1 },
    { q: 'How many cards are in a standard deck (no jokers)?', o: ['48', '50', '52', '54'], a: 2 },
    { q: 'What color do you get by mixing blue and yellow?', o: ['Green', 'Purple', 'Orange', 'Gray'], a: 0 },
    { q: 'Which direction does the sun rise from?', o: ['West', 'North', 'South', 'East'], a: 3 }
  ];
  const TIME_LIMIT = 8;   // seconds per question

  BrawlBox.registerGame('trivia-buzz', {
    start(stage, api) {
      const { shuffle } = BrawlBox.util;
      let score = 0, qi = 0, t0 = 0, locked = false, order = shuffle(QS);
      let tm = null, nextT = null;

      stage.innerHTML = `
        <style>
          .tb-q { font-size: 1.8rem; font-weight: 800; max-width: 700px; margin: 0; }
          .tb-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: min(90vw, 600px); }
          .tb-opt { font: inherit; font-size: 1.2rem; font-weight: 800; padding: 18px; border: 0; border-radius: 18px;
            background: #fff; color: #241b4b; cursor: pointer; box-shadow: 0 5px 0 #c4b5fd; }
          .tb-opt.right { background: #4ade80; }
          .tb-opt.wrong { background: #ef4444; color: #fff; }
        </style>
        <p class="tb-q" id="tb-q"></p>
        <div class="tb-opts" id="tb-opts"></div>
        <p class="g-sub" id="tb-info">&nbsp;</p>`;

      const qEl = stage.querySelector('#tb-q');
      const optsEl = stage.querySelector('#tb-opts');
      const info = stage.querySelector('#tb-info');

      function show() {
        if (qi >= order.length) { order = shuffle(QS); qi = 0; }
        const Q = order[qi];
        locked = false;
        info.textContent = '\u00a0';
        t0 = performance.now();
        qEl.textContent = Q.q;
        optsEl.innerHTML = '';
        Q.o.forEach((text, idx) => {
          const b = document.createElement('button');
          b.className = 'tb-opt';
          b.textContent = text;
          b.onpointerdown = (e) => answer(idx, b, e);
          optsEl.appendChild(b);
        });
        tm = setTimeout(() => {
          if (locked) return;
          locked = true;
          api.sfx('bad');
          reveal(Q.a);
          info.textContent = "Time's up!";
          next(900);
        }, TIME_LIMIT * 1000);
      }

      function reveal(correctIdx) {
        if (optsEl.children[correctIdx]) optsEl.children[correctIdx].classList.add('right');
      }

      function answer(idx, btn, e) {
        if (locked) return;
        locked = true;
        clearTimeout(tm);
        const Q = order[qi];
        if (idx === Q.a) {
          const elapsed = (performance.now() - t0) / 1000;
          const pts = Math.max(20, Math.round(100 - elapsed * 10));
          score += pts;
          api.setScore(score);
          api.sfx('good');
          api.burst(e.clientX, e.clientY, 30);
          btn.classList.add('right');
          info.textContent = `+${pts} points!`;
        } else {
          api.sfx('bad');
          btn.classList.add('wrong');
          reveal(Q.a);
          info.textContent = 'Not quite!';
        }
        next(900);
      }

      function next(ms) {
        nextT = setTimeout(() => { qi++; show(); }, ms);
      }

      api.onStop(() => { clearTimeout(tm); clearTimeout(nextT); });
      show();
    },
  });
})();
