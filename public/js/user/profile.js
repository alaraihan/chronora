    document.getElementById('profileBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('dropdownMenu').classList.toggle('show');
    });
    document.addEventListener('click', () => {
      const menu = document.getElementById('dropdownMenu');
      if (menu && menu.classList.contains('show')) menu.classList.remove('show');
    });