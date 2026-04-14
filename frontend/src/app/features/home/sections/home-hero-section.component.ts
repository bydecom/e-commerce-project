import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-hero-section',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="relative h-[500px] overflow-hidden rounded-3xl bg-gray-900 text-white">
      <div
        class="absolute inset-0 bg-cover bg-center opacity-50"
        style="background-image: url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1600&q=80');"
      ></div>
      <div class="relative z-10 flex h-full flex-col justify-center px-10">
        <h1 class="max-w-2xl text-5xl font-extrabold leading-tight md:text-6xl">
          Future Tech, <br /><span class="text-indigo-400">Today.</span>
        </h1>
        <p class="mt-4 max-w-lg text-lg text-gray-300">
          Experience the next generation of devices curated just for you.
        </p>
        <a
          routerLink="/products"
          class="mt-8 w-fit rounded-full bg-white px-8 py-3 font-bold text-gray-900 transition-transform hover:scale-105 hover:bg-gray-100"
        >
          Shop Collection
        </a>
      </div>
    </section>
  `,
})
export class HomeHeroSectionComponent {}
