
from django.conf import settings
from django.core.urlresolvers import reverse
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.http import require_POST
from django.views.generic import View, ListView, DetailView

from .models import Game, Chain, Message
from .forms import ResponseForm

class GamesView(ListView):
    template_name = 'telephone/games.html'
    model = Game

    def get_queryset(self):
        """ Only show active games """
        return self.model._default_manager.filter(status = 'ACTIV')

class PlayView(View):
    def get(self, request, pk):
        """ Determine what to do when a user requests the game page.

        Outcomes
        --------
        1. First time users should get the instructions page.
        2. Instructed users should get an entry form.
        3. Completed users should get a completion page.
        """
        self.game = get_object_or_404(Game, pk = pk)

        instructed = request.session.get('instructed', False)
        request.session['instructed'] = instructed

        if not instructed:
            return self.instruct(request)

        receipts = request.session.get('receipts', list())
        request.session['receipts'] = receipts

        try:
            return self.play(request)
        except Chain.DoesNotExist:
            return self.complete(request)

    def instruct(self, request):
        """ Render the instructions for the telephone game """
        return render(request, 'telephone/instruct.html', {'game': self.game})

    def play(self, request):
        """ Render an entry form for a cluster not already in the session.

        Raises an exception (Cluster.DoesNotExist) if there are no more
        clusters.
        """
        context_data = {}
        context_data['game'] = self.game

        receipts = request.session['receipts']
        chain = self.game.pick_next_chain(receipts)
        message = chain.pick_next_message()
        context_data['url'] = message.audio.url

        form = ResponseForm(initial = {'parent': message.pk})

        if request.is_ajax():
            return JsonResponse(form.as_dict())

        context_data['form'] = form
        return render(request, 'telephone/play.html', context_data)

    def post(self, request, pk):
        """ Determine what to do with an entry.

        A valid entry appends a receipt to the session, and tries to get
        the next form. Otherwise, pass back the same form with validation
        errors.

        Outcomes
        --------
        1. If available, play the next cluster.
        2. If not, get the completion page.
        3. If the entry didn't work, render the errors.
        """
        self.game = get_object_or_404(Game, pk = pk)

        form = ResponseForm(data = request.POST, files = request.FILES)

        if form.is_valid():
            message = form.save()

            receipts = request.session.get('receipts', list())
            receipts.append(message.chain.pk)
            request.session['receipts'] = receipts

            try:
                return self.play(request)
            except Message.DoesNotExist:
                return self.complete(request)
        else:
            parent = form.instance.parent
            context_data = {
                'game': self.game,
                'url': parent.audio.url,
                'form': form
            }
            return render(request, 'telephone/play.html', context_data)

    def complete(self, request):
        if request.is_ajax():
            return JsonResponse({'complete': self.game.get_absolute_url()})

        return render(request, 'telephone/complete.html', {'game': self.game})

class InspectView(DetailView):
    template_name = 'telephone/inspect.html'
    model = Game

class MessageView(DetailView):
    template_name = 'telephone/edit.html'
    model = Message

@require_POST
def upload(request, pk):
    form = MessageForm(request.POST, request.FILES)
    if form.is_valid():
        message = form.save()

        message.replicate()

@require_POST
def accept(request, pk):
    request.session['instructed'] = True
    return redirect('play', pk = pk)

@require_POST
def clear(request, pk):
    request.session['receipts'] = list()
    return redirect('play', pk = pk)
